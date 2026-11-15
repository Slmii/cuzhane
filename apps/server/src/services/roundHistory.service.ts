import { CONFLICT, FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { slotIndexForBab } from '@utils/babs';
import { visibleUserId } from '@utils/groupPrivacy';
import {
	civilDayNumber,
	roundEndsAt,
	roundIndexSince,
	roundLengthFor,
	roundStartedAtFor,
	type CycleName
} from '@utils/rounds';
import { unitCountFor } from '@utils/units';
import { normalizeUserId } from '@utils/normalizeUserId';
import { assertRepetitionsMet } from './repetitions.service';
import { ensureCurrentRoundFor } from './rounds.service';
import { requireMembership } from './groupAccess.service';
import { babNumbersInRound, toSplitMode } from './groupSerializers';
import type { Group, GroupMember } from '../generated/prisma/client';

export type RoundSummary = {
	roundIndex: number;
	startedAt: string;
	endsAt: string;
	/** How many parts the round had to cover — what `readCount` and `missedCount` are out of. */
	partCount: number;
	readCount: number;
	missedCount: number;
	/**
	 * Which parts nobody read, ascending — the complement of the round's reads over the part
	 * count, so it has exactly `missedCount` entries. Always empty for the open round, whose day
	 * is not over. Turlar names them on a Hizb round's card when there are three or fewer.
	 */
	missedPartNumbers: number[];
	/** Babs this member was owed and read, of the babs they were owed. */
	myReadCount: number;
	myOwedCount: number;
	isOpen: boolean;
};

export type RoundBab = {
	number: number;
	/** Who actually read it — null while it is still missing. */
	readByUserId: string | null;
	readAt: string | null;
	/** Whose share it was that round. Null means it belonged to an empty seat's block. */
	owedByUserId: string | null;
	owedBySlotIndex: number | null;
	/** True when no member held the seat, so the block sat in the shared pool. */
	isPool: boolean;
};

export type RoundDetail = {
	roundIndex: number;
	startedAt: string;
	endsAt: string;
	isOpen: boolean;
	/** Calendar days late in the group's zone; the exclusive deadline starts day one. */
	daysLate: number;
	/** See `RoundSummary.partCount`; `babs` has exactly this many entries. */
	partCount: number;
	readCount: number;
	missedCount: number;
	/** How many members still owe at least one bab from this round. */
	missedPeopleCount: number;
	babs: RoundBab[];
};

/**
 * Which seat owed a given bab in a given round — the inverse of the rotation.
 *
 * A ROTATION seat `s` reads block `(s + roundIndex) % spots`, so the seat responsible for
 * the block a bab falls in is that arithmetic run backwards. FIXED never moves, so the
 * block index is the seat. This is what lets a closed round be attributed at all: nothing
 * stores who owed what, exactly as nothing stores who reads what.
 */
const owedSlotForBab = (group: Pick<Group, 'spots' | 'splitMode' | 'kind'>, babNumber: number, roundIndex: number) => {
	if (group.splitMode === 'FLEXIBLE') {
		return null;
	}
	const blockIndex = slotIndexForBab(babNumber, group.spots, unitCountFor(group));

	if (blockIndex === null) {
		return null;
	}

	if (toSplitMode(group.splitMode) !== 'ROTATION') {
		return blockIndex;
	}

	const offset = Math.max(0, Math.floor(roundIndex)) % group.spots;

	return (blockIndex - offset + group.spots) % group.spots;
};

/**
 * **A hatim owes what was held, not what a seat derives.** A member holds specific cüz, round
 * by round, in `CuzHolding` — chosen, carried, re-picked or taken as a loan — so the seat
 * arithmetic above means nothing for one: at ten seats it hands cüz 1–10 to seat 0 whoever
 * actually held them. The same rule `getMyProgressForUser` follows below.
 *
 * Every round's holdings for the group, in one query, as cüz → holder per round.
 */
const holdersByRound = async (groupId: string, roundIndexes?: { gte?: number; equals?: number }) => {
	const holdings = await prisma.cuzHolding.findMany({
		select: { cuzNumber: true, roundIndex: true, userId: true },
		where: { groupId, ...(roundIndexes ? { roundIndex: roundIndexes } : {}) }
	});
	const byRound = new Map<number, Map<number, string>>();

	for (const holding of holdings) {
		const round = byRound.get(holding.roundIndex) ?? new Map<number, string>();

		round.set(holding.cuzNumber, holding.userId);
		byRound.set(holding.roundIndex, round);
	}

	return byRound;
};

const boundsFor = (group: Group, roundIndex: number) => {
	// A group cannot have history before it started, so `startedAt` is non-null on every
	// path that reaches here — the callers all guard on RUNNING first.
	const startedAt = group.startedAt as Date;
	const length = roundLengthFor(group);
	const start = roundStartedAtFor(startedAt, length, roundIndex, group.timezone);

	return { startedAt: start, endsAt: roundEndsAt(startedAt, length, roundIndex, group.timezone) };
};

const loadRunningGroup = async (userId: string, groupId: string) => {
	const normalizedUserId = normalizeUserId(userId);
	// The membership is returned as well as checked: `requireMembership` has already loaded
	// the row, and `slotIndex` is what any per-viewer answer is derived from. Fetching it a
	// second time would be a second query for a row already in hand.
	const member = await requireMembership(normalizedUserId, groupId);
	// Read the round the calendar is actually on before deciding what counts as history —
	// otherwise the round that just closed would still look open.
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUnique({ where: { id: groupId } });

	if (!group) {
		throw new HttpError(NOT_FOUND, 'Group not found');
	}

	if (group.status !== 'RUNNING' || !group.startedAt) {
		throw new HttpError(FORBIDDEN, 'This hatim has not started yet');
	}

	return { group, member, normalizedUserId };
};

/**
 * Every round the group has made a pass at, newest first, with the open one flagged.
 *
 * Counts come from `BabRead` rather than `GroupBab`: the board only ever describes the
 * round in progress, so anything historical has to be read from the append-only log.
 */
export const listRoundsForUser = async (userId: string, groupId: string): Promise<RoundSummary[]> => {
	const { group, normalizedUserId } = await loadRunningGroup(userId, groupId);

	const [members, reads, holders] = await Promise.all([
		prisma.groupMember.findMany({ where: { groupId }, orderBy: { slotIndex: 'asc' } }),
		prisma.babRead.findMany({
			where: { groupId },
			select: { roundIndex: true, babNumber: true, userId: true }
		}),
		group.kind === 'HATIM' ? holdersByRound(groupId) : Promise.resolve(null)
	]);

	const viewer = members.find(member => member.userId === normalizedUserId);
	const partCount = unitCountFor(group);
	const readsByRound = new Map<number, { total: number; mine: number; numbers: Set<number> }>();

	for (const read of reads) {
		const bucket = readsByRound.get(read.roundIndex) ?? { total: 0, mine: 0, numbers: new Set<number>() };

		bucket.total += 1;
		bucket.numbers.add(read.babNumber);

		if (read.userId === normalizedUserId) {
			bucket.mine += 1;
		}

		readsByRound.set(read.roundIndex, bucket);
	}

	const summaries: RoundSummary[] = [];

	for (let roundIndex = group.roundIndex; roundIndex >= 0; roundIndex--) {
		const bucket = readsByRound.get(roundIndex) ?? { total: 0, mine: 0, numbers: new Set<number>() };
		const { startedAt, endsAt } = boundsFor(group, roundIndex);
		const isOpen = roundIndex === group.roundIndex;
		const owedCount =
			viewer === undefined
				? 0
				: holders
				? [...(holders.get(roundIndex)?.values() ?? [])].filter(holder => holder === normalizedUserId).length
				: Array.from({ length: partCount }, (_, index) => index + 1).filter(
						babNumber => owedSlotForBab(group, babNumber, roundIndex) === viewer.slotIndex
				  ).length;

		summaries.push({
			roundIndex,
			startedAt: startedAt.toISOString(),
			endsAt: endsAt.toISOString(),
			partCount,
			readCount: bucket.total,
			// An open round has nothing "missing" yet — the day is not over.
			missedCount: isOpen ? 0 : partCount - bucket.total,
			missedPartNumbers: isOpen
				? []
				: Array.from({ length: partCount }, (_, index) => index + 1).filter(
						number => !bucket.numbers.has(number)
				  ),
			myReadCount: bucket.mine,
			myOwedCount: owedCount,
			isOpen
		});
	}

	return summaries;
};

/** One round, bab by bab, with who owed it and who ended up reading it. */
export const getRoundDetailForUser = async (
	userId: string,
	groupId: string,
	roundIndex: number
): Promise<RoundDetail> => {
	const { group, normalizedUserId } = await loadRunningGroup(userId, groupId);

	if (roundIndex < 0 || roundIndex > group.roundIndex) {
		throw new HttpError(NOT_FOUND, 'Round not found');
	}

	const [members, reads, holders] = await Promise.all([
		prisma.groupMember.findMany({ where: { groupId }, orderBy: { slotIndex: 'asc' } }),
		prisma.babRead.findMany({
			where: { groupId, roundIndex },
			select: { babNumber: true, userId: true, readAt: true }
		}),
		group.kind === 'HATIM'
			? holdersByRound(groupId, { equals: roundIndex }).then(byRound => byRound.get(roundIndex) ?? new Map())
			: Promise.resolve(null)
	]);

	const memberBySlot = new Map<number, GroupMember>(members.map(member => [member.slotIndex, member]));
	const memberByUserId = new Map<string, GroupMember>(members.map(member => [member.userId, member]));
	const readByNumber = new Map(reads.map(read => [read.babNumber, read]));
	const partCount = unitCountFor(group);

	const babs: RoundBab[] = Array.from({ length: partCount }, (_, index) => {
		const number = index + 1;
		const read = readByNumber.get(number);

		// A hatim: whoever held the cüz that round. Held by nobody, it was never anyone's to
		// miss. Leaving (and deleting an account) removes a member's holdings for every round,
		// so a cüz a departed member held reads as unheld here — as a Cevşen seat vacated
		// mid-history does.
		if (holders) {
			const holderId = holders.get(number) ?? null;

			return {
				number,
				readByUserId: read?.userId ?? null,
				readAt: read?.readAt.toISOString() ?? null,
				owedByUserId: holderId,
				owedBySlotIndex: holderId === null ? null : memberByUserId.get(holderId)?.slotIndex ?? null,
				isPool: holderId === null
			};
		}

		const slotIndex = owedSlotForBab(group, number, roundIndex);
		const owner = slotIndex === null ? undefined : memberBySlot.get(slotIndex);

		return {
			number,
			readByUserId: read?.userId ?? null,
			readAt: read?.readAt.toISOString() ?? null,
			owedByUserId: owner?.userId ?? null,
			owedBySlotIndex: slotIndex,
			// Nobody held the seat, so the block was never anyone's to miss.
			isPool: owner === undefined
		};
	});

	const missed = babs.filter(bab => bab.readByUserId === null);
	const { startedAt, endsAt } = boundsFor(group, roundIndex);
	const isOpen = roundIndex === group.roundIndex;

	return {
		roundIndex,
		startedAt: startedAt.toISOString(),
		endsAt: endsAt.toISOString(),
		isOpen,
		daysLate: isOpen
			? 0
			: Math.max(1, civilDayNumber(new Date(), group.timezone) - civilDayNumber(endsAt, group.timezone) + 1),
		partCount,
		readCount: partCount - missed.length,
		missedCount: missed.length,
		missedPeopleCount: new Set(missed.map(bab => bab.owedByUserId).filter(Boolean)).size,
		babs: babs.map(bab => ({
			...bab,
			readByUserId: visibleUserId(group, normalizedUserId, bab.readByUserId),
			owedByUserId: visibleUserId(group, normalizedUserId, bab.owedByUserId)
		}))
	};
};

/**
 * Covers a bab that a closed round left unread — the design's "Üstlen" and, on your own
 * block, "Okudum".
 *
 * This does not reopen the round. It writes the one fact that was missing from it: a
 * `BabRead` row for `(groupId, roundIndex, babNumber)`. Nothing is overwritten, which is
 * why the history stays honest — the unique key means a cover can only ever fill a gap,
 * never displace whoever read it first. `GroupBab` is untouched: that describes the round
 * in progress, and this one is over.
 */
export const coverMissedBabsForUser = async (
	userId: string,
	groupId: string,
	roundIndex: number,
	babNumbers: number[]
): Promise<RoundDetail> => {
	const { group, member, normalizedUserId } = await loadRunningGroup(userId, groupId);

	/*
	 * Only rounds since the member joined. A round that closed before they had a seat was never
	 * theirs to fill, and covering it would write their name over the group's history and into
	 * their own totals and streak — the same floor `getMyProgressForUser` puts on their record.
	 */
	const joinedRoundIndex = roundIndexSince(
		group.startedAt as Date,
		roundLengthFor(group),
		member.joinedAt,
		group.timezone
	);

	if (roundIndex < joinedRoundIndex) {
		throw new HttpError(FORBIDDEN, 'That round closed before you joined');
	}

	if (roundIndex < 0 || roundIndex >= group.roundIndex) {
		// The open round is covered by the ordinary read paths, which also keep the board
		// and `completedAt` in step. Only closed rounds come through here.
		throw new HttpError(FORBIDDEN, 'Only a closed round can be covered');
	}

	const wanted = [...new Set(babNumbers)];
	// The route bounds the numbers by the Cevşen's hundred; a Hizb group stops at 32.
	const partCount = unitCountFor(group);

	if (wanted.some(babNumber => !Number.isInteger(babNumber) || babNumber < 1 || babNumber > partCount)) {
		throw new HttpError(NOT_FOUND, 'Bab not found');
	}

	/*
	 * Held to the count only for what this request will actually write. A Sekine somebody else
	 * already covered is theirs, and `skipDuplicates` below leaves it alone — refusing the rest
	 * of the block over it would turn a generous act away for a part it never touches. A race
	 * that covers one in between only means the insert skips it; a request with nothing left
	 * still gets the "already read" 409 below.
	 *
	 * Against the round being covered, not the one open now: nineteen recited today are today's.
	 */
	const covered = await prisma.babRead.findMany({
		where: { groupId, roundIndex, babNumber: { in: wanted } },
		select: { babNumber: true }
	});
	const coveredNumbers = new Set(covered.map(read => read.babNumber));

	await assertRepetitionsMet(prisma, {
		group,
		userId: normalizedUserId,
		roundIndex,
		babNumbers: wanted.filter(babNumber => !coveredNumbers.has(babNumber))
	});

	// `skipDuplicates` rather than a transaction that fails on the first clash: taking on
	// someone's whole block is a generous act, and having it rejected outright because one
	// bab was covered a second earlier would be a poor way to answer it. Whatever is still
	// missing gets written; whatever isn't, stays with whoever got there first.
	const created = await prisma.babRead.createMany({
		data: wanted.map(babNumber => ({ babNumber, groupId, roundIndex, userId: normalizedUserId })),
		skipDuplicates: true
	});

	if (created.count === 0) {
		throw new HttpError(CONFLICT, 'These babs have already been read');
	}

	return getRoundDetailForUser(userId, groupId, roundIndex);
};

/**
 * **Every round this member has been in, not a window.**
 *
 * It returned the last seven or eight, which is what the strip draws — and that made the
 * banner's "62 kaçırılan" mean "in the last seven days", while the list under it was the
 * same seven days. Both were then a partial answer to a question nobody asked partially:
 * what is outstanding is what is outstanding, whenever it fell behind.
 *
 * The strip still shows seven cells or eight; it takes them from the end of this list. The
 * cost is a walk from the member's first round rather than from seven days ago — the same
 * shape `listRoundsForUser` has always had, and bounded by how long they have been in the
 * group rather than by how long the group has run.
 */

export type MyProgressPeriod = {
	roundIndex: number;
	/**
	 * When the round opened, in the **group's** zone. The client formats the strip's
	 * weekday label from this rather than being sent one: round arithmetic is server-only
	 * (`utils/rounds.ts` says so in its header), but naming a weekday is localisation, and
	 * the client is the side that knows whether to say "Pt", "Mo" or "Ma".
	 */
	startedAt: string;
	endsAt: string;
	isOpen: boolean;
	/**
	 * How many babs this seat owed that round.
	 *
	 * A count, not the numbers: the missed list draws only the gaps, so nothing on the client
	 * needs the whole set. It briefly sent the numbers, to colour read and missed squares
	 * differently — that design was built and dropped, and the field went back with it rather
	 * than staying as a payload nobody reads.
	 *
	 * **Never a constant** — `partCount / spots`, with the first `partCount % spots` seats
	 * getting one extra, and under ROTATION the seat moves each round, so the same member can
	 * owe 9 one round and 8 the next.
	 */
	owedCount: number;
	/**
	 * Of those, the ones this member has read — **whenever they read them**.
	 *
	 * It counted only reads that landed before the round closed, so that the strip could be
	 * the record as it stood at the boundary. That was read off a footnote the design later
	 * dropped, and it does not survive contact with the rest of the screen: covering every
	 * outstanding bab left the card saying "0 kaçırılan · 0% tamamlama", which is two true
	 * halves of a sentence that cannot both be true. Completion has to move when you catch
	 * up, or it is not completion.
	 */
	readCount: number;
	/**
	 * How many of `missedBabs` there are — owed, and read by nobody.
	 *
	 * **The same quantity the list shows, deliberately.** It used to be "owed minus read in
	 * time", which counted a bab you had since covered: the card said 74 over a list of 62,
	 * two numbers under one word with nothing on screen to tell them apart.
	 */
	missedCount: number;
	/**
	 * Owed, and read by nobody — the babs the missed list offers with a "Bab N →" pill.
	 *
	 * Each carries its round explicitly rather than leaning on the period's. Today they are
	 * always equal — a period is one round — and the reader still wants it stated: it covers
	 * *that* round rather than today's board, where the rotation has already moved the bab on.
	 *
	 * Read by *nobody*, not "not read by me": once another member covers a bab there is
	 * nothing left for this reader to do and `coverMissedBabsForUser` would answer 409, so
	 * offering it would be offering a dead end. Such a bab leaves this list without ever
	 * joining `readCount` — the "separately" half of the same promise.
	 *
	 * Always empty for the open round: nothing is missed while there is still time.
	 */
	missedBabs: { babNumber: number; roundIndex: number }[];
	/**
	 * **A hatim's cüz, each with its outcome** — what Q6 draws as one cell per cüz: read,
	 * missed, or (in the open round) still open. Empty for a Cevşen group, whose strip draws
	 * only counts; see `owedCount` for why the numbers stay off that payload.
	 *
	 * `isRead` is "read by anyone", the same test `missedBabs` uses, so a closed round's cells
	 * and its missed list can never disagree. In a hatim only the holder can mark a cüz, so
	 * that is also "read by you".
	 */
	units: { number: number; isRead: boolean }[];
};

export type MyProgress = {
	cycle: CycleName;
	/** Oldest first — the strip reads left to right and ends on the open round. */
	periods: MyProgressPeriod[];
	/** Summed across the whole window, the open round included. */
	readCount: number;
	owedCount: number;
	/** Summed across the **closed** rounds only. See `missedBabNumbers`. */
	missedCount: number;
	ratePercent: number;
};

/**
 * One member's own record over the last few rounds — what F7 draws and what the card on
 * the group screen summarises.
 *
 * It is deliberately not built on `listRoundsForUser`, whose `myReadCount` counts **every**
 * row the viewer wrote in a round — pool claims and covers of other people's blocks
 * included — so it can exceed what they were owed and would colour a cell "full" for work
 * that was never theirs. This asks the narrower question: of the babs your seat owed, how
 * many did you read, and which are still outstanding.
 */
export const getMyProgressForUser = async (userId: string, groupId: string): Promise<MyProgress> => {
	const { group, member } = await loadRunningGroup(userId, groupId);

	/*
	 * **Where the member's own history starts.** Without this floor, someone joining a
	 * ten-day-old group is told on arrival that they missed sixty babs — rounds that closed
	 * before they had a seat, attributed to them because the seat they now hold was unfilled
	 * at the time. `listRoundsForUser` has the same blind spot, but it reports the *group's*
	 * misses; this screen puts a number against one person, so being wrong reads as an
	 * accusation.
	 */
	const joinedRoundIndex = roundIndexSince(
		group.startedAt as Date,
		roundLengthFor(group),
		member.joinedAt,
		group.timezone
	);
	/*
	 * Capped at the round the group is on. For a repeating group that changes nothing — nobody
	 * joins after the present — but a one-off ("Tek seferlik") never leaves round 0 however long
	 * it runs, while the arithmetic above keeps counting stretches of `roundDays`. Someone joining
	 * after the first stretch got a floor past the only round there is, and an empty record.
	 */
	const oldestRoundIndex = Math.min(Math.max(0, joinedRoundIndex), group.roundIndex);

	/*
	 * What this seat owed, round by round — computed first, because it is also what the query
	 * below is narrowed by.
	 *
	 * **Rounds are grouped by the block they owe.** Under ROTATION a seat advances one whole
	 * seat per round, so the block repeats every `spots` rounds: a year of daily rounds owes
	 * only `spots` distinct blocks between them. Fetching per block rather than per round
	 * turns hundreds of clauses into at most `spots` of them.
	 */
	const owedByRound = new Map<number, number[]>();
	const isHatim = group.kind === 'HATIM';

	/*
	 * **A hatim owes what was held, not what a seat derives.** A member holds *specific* cüz,
	 * round by round — chosen on the way in, carried by KEEP, re-picked by REPICK, or taken
	 * from the havuz as a loan — and `CuzHolding` keeps every round's rows. The seat maths
	 * below would hand a hatim member a slice of the hundred that has nothing to do with them.
	 */
	const holdings = isHatim
		? await prisma.cuzHolding.findMany({
				orderBy: { cuzNumber: 'asc' },
				select: { cuzNumber: true, roundIndex: true },
				where: { groupId, roundIndex: { gte: oldestRoundIndex, lte: group.roundIndex }, userId: member.userId }
		  })
		: [];

	for (let roundIndex = oldestRoundIndex; roundIndex <= group.roundIndex; roundIndex++) {
		owedByRound.set(
			roundIndex,
			isHatim
				? holdings.filter(holding => holding.roundIndex === roundIndex).map(holding => holding.cuzNumber)
				: babNumbersInRound(group, member.slotIndex, roundIndex)
		);
	}

	const roundsByBlock = new Map<string, { babNumbers: number[]; roundIndexes: number[] }>();

	for (const [roundIndex, owed] of owedByRound) {
		// A round in which nothing was held asks the database nothing.
		if (owed.length === 0) {
			continue;
		}

		const key = owed.join(',');
		const block = roundsByBlock.get(key) ?? { babNumbers: owed, roundIndexes: [] };

		block.roundIndexes.push(roundIndex);
		roundsByBlock.set(key, block);
	}

	/*
	 * **Only the babs this member owed**, not the whole board.
	 *
	 * It fetched every `BabRead` row in the group since they joined — everyone's reads, all
	 * hundred babs a round — and then consulted the dozen-odd that were theirs. For a member
	 * a year into a busy DAILY group that is ~36k rows to answer a question about ~4.7k, and
	 * this endpoint sits behind the group screen and every "Okudum". Narrowing to the owed
	 * blocks divides the rows by `spots`.
	 *
	 * `readAt` is gone from the `select` with it: it was read by the on-time rule, and that
	 * rule was dropped when "kaçırılan" and the missed list were made one number.
	 */
	const reads =
		roundsByBlock.size === 0
			? []
			: await prisma.babRead.findMany({
					where: {
						groupId,
						OR: [...roundsByBlock.values()].map(block => ({
							babNumber: { in: block.babNumbers },
							roundIndex: { in: block.roundIndexes }
						}))
					},
					select: { babNumber: true, roundIndex: true, userId: true }
			  });

	// Indexed by round so the loop below is a lookup rather than a scan of every read for
	// every round.
	const readsByRound = new Map<number, typeof reads>();

	for (const read of reads) {
		const bucket = readsByRound.get(read.roundIndex) ?? [];

		bucket.push(read);
		readsByRound.set(read.roundIndex, bucket);
	}

	const periods: MyProgressPeriod[] = [];

	for (let roundIndex = oldestRoundIndex; roundIndex <= group.roundIndex; roundIndex++) {
		const { endsAt, startedAt } = boundsFor(group, roundIndex);
		const owed = owedByRound.get(roundIndex) ?? [];
		// Every row the query returned for this round is already one of `owed` — that is what
		// the `OR` above asks for — so there is nothing left to filter out.
		const inRound = readsByRound.get(roundIndex) ?? [];
		const readByAnyone = new Set(inRound.map(read => read.babNumber));
		const readCount = inRound.filter(read => read.userId === member.userId).length;
		const isOpen = roundIndex === group.roundIndex;
		const missedBabs = isOpen
			? []
			: owed.filter(babNumber => !readByAnyone.has(babNumber)).map(babNumber => ({ babNumber, roundIndex }));

		periods.push({
			endsAt: endsAt.toISOString(),
			isOpen,
			missedBabs,
			missedCount: missedBabs.length,
			owedCount: owed.length,
			readCount,
			roundIndex,
			startedAt: startedAt.toISOString(),
			units: isHatim ? owed.map(number => ({ isRead: readByAnyone.has(number), number })) : []
		});
	}

	const owedCount = periods.reduce((total, period) => total + period.owedCount, 0);
	const readCount = periods.reduce((total, period) => total + period.readCount, 0);

	return {
		cycle: group.cycle,
		missedCount: periods.reduce((total, period) => total + period.missedCount, 0),
		owedCount,
		periods,
		ratePercent: owedCount === 0 ? 0 : Math.round((readCount / owedCount) * 100),
		readCount
	};
};
