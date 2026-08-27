import { CONFLICT, FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { BAB_COUNT, slotIndexForBab } from '@utils/babs';
import { ROUND_DAYS, roundEndsAt, roundStartedAtFor } from '@utils/rounds';
import { normalizeUserId } from '@utils/normalizeUserId';
import { ensureCurrentRoundFor } from './rounds.service';
import { requireMembership } from './groupAccess.service';
import { toSplitMode } from './groupSerializers';
import type { Group, GroupMember } from '../generated/prisma/client';

export type RoundSummary = {
	roundIndex: number;
	startedAt: string;
	endsAt: string;
	readCount: number;
	missedCount: number;
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
const owedSlotForBab = (group: Pick<Group, 'spots' | 'splitMode'>, babNumber: number, roundIndex: number) => {
	const blockIndex = slotIndexForBab(babNumber, group.spots);

	if (blockIndex === null) {
		return null;
	}

	if (toSplitMode(group.splitMode) !== 'ROTATION') {
		return blockIndex;
	}

	const offset = Math.max(0, Math.floor(roundIndex)) % group.spots;

	return (blockIndex - offset + group.spots) % group.spots;
};

const boundsFor = (group: Group, roundIndex: number) => {
	// A group cannot have history before it started, so `startedAt` is non-null on every
	// path that reaches here — the callers all guard on RUNNING first.
	const startedAt = group.startedAt as Date;
	const start = roundStartedAtFor(startedAt, ROUND_DAYS[group.cycle], roundIndex, group.timezone);

	return { startedAt: start, endsAt: roundEndsAt(start, group.cycle, group.timezone) };
};

const loadRunningGroup = async (userId: string, groupId: string) => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
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

	return { group, normalizedUserId };
};

/**
 * Every round the group has made a pass at, newest first, with the open one flagged.
 *
 * Counts come from `BabRead` rather than `GroupBab`: the board only ever describes the
 * round in progress, so anything historical has to be read from the append-only log.
 */
export const listRoundsForUser = async (userId: string, groupId: string): Promise<RoundSummary[]> => {
	const { group, normalizedUserId } = await loadRunningGroup(userId, groupId);

	const [members, reads] = await Promise.all([
		prisma.groupMember.findMany({ where: { groupId }, orderBy: { slotIndex: 'asc' } }),
		prisma.babRead.findMany({
			where: { groupId },
			select: { roundIndex: true, babNumber: true, userId: true }
		})
	]);

	const viewer = members.find(member => member.userId === normalizedUserId);
	const readsByRound = new Map<number, { total: number; mine: number }>();

	for (const read of reads) {
		const bucket = readsByRound.get(read.roundIndex) ?? { total: 0, mine: 0 };

		bucket.total += 1;

		if (read.userId === normalizedUserId) {
			bucket.mine += 1;
		}

		readsByRound.set(read.roundIndex, bucket);
	}

	const summaries: RoundSummary[] = [];

	for (let roundIndex = group.roundIndex; roundIndex >= 0; roundIndex--) {
		const bucket = readsByRound.get(roundIndex) ?? { total: 0, mine: 0 };
		const { startedAt, endsAt } = boundsFor(group, roundIndex);
		const owedCount =
			viewer === undefined
				? 0
				: Array.from({ length: BAB_COUNT }, (_, index) => index + 1).filter(
						babNumber => owedSlotForBab(group, babNumber, roundIndex) === viewer.slotIndex
				  ).length;

		summaries.push({
			roundIndex,
			startedAt: startedAt.toISOString(),
			endsAt: endsAt.toISOString(),
			readCount: bucket.total,
			// An open round has nothing "missing" yet — the day is not over.
			missedCount: roundIndex === group.roundIndex ? 0 : BAB_COUNT - bucket.total,
			myReadCount: bucket.mine,
			myOwedCount: owedCount,
			isOpen: roundIndex === group.roundIndex
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
	const { group } = await loadRunningGroup(userId, groupId);

	if (roundIndex < 0 || roundIndex > group.roundIndex) {
		throw new HttpError(NOT_FOUND, 'Round not found');
	}

	const [members, reads] = await Promise.all([
		prisma.groupMember.findMany({ where: { groupId }, orderBy: { slotIndex: 'asc' } }),
		prisma.babRead.findMany({
			where: { groupId, roundIndex },
			select: { babNumber: true, userId: true, readAt: true }
		})
	]);

	const memberBySlot = new Map<number, GroupMember>(members.map(member => [member.slotIndex, member]));
	const readByNumber = new Map(reads.map(read => [read.babNumber, read]));

	const babs: RoundBab[] = Array.from({ length: BAB_COUNT }, (_, index) => {
		const number = index + 1;
		const read = readByNumber.get(number);
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

	return {
		roundIndex,
		startedAt: startedAt.toISOString(),
		endsAt: endsAt.toISOString(),
		isOpen: roundIndex === group.roundIndex,
		readCount: BAB_COUNT - missed.length,
		missedCount: missed.length,
		missedPeopleCount: new Set(missed.map(bab => bab.owedByUserId).filter(Boolean)).size,
		babs
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
	const { group, normalizedUserId } = await loadRunningGroup(userId, groupId);

	if (roundIndex < 0 || roundIndex >= group.roundIndex) {
		// The open round is covered by the ordinary read paths, which also keep the board
		// and `completedAt` in step. Only closed rounds come through here.
		throw new HttpError(FORBIDDEN, 'Only a closed round can be covered');
	}

	const wanted = [...new Set(babNumbers)];

	if (wanted.some(babNumber => !Number.isInteger(babNumber) || babNumber < 1 || babNumber > BAB_COUNT)) {
		throw new HttpError(NOT_FOUND, 'Bab not found');
	}

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
