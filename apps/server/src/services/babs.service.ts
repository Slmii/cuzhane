import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { babRuns, formatRun } from '@utils/babs';
import { partCountFor, type GroupKindName } from '@utils/groupKinds';
import { FALLBACK_DISPLAY_NAME, getMemberProfiles } from '@utils/memberProfiles';
import { normalizeUserId } from '@utils/normalizeUserId';
import { groupReadPush, roundCompletePush, toPushLanguage } from '@utils/pushCopy';
import type { Prisma } from '../generated/prisma/client';
import { requireMembership } from './groupAccess.service';
import { recordNotification } from './notifications.service';
import { sendPushToUser } from './push.service';
import { poolBabNumbers, serializeBab, shareBabNumbersToday } from './groupSerializers';
import { ensureCurrentRound, ensureCurrentRoundFor } from './rounds.service';
import type { GroupBab, GroupStatus } from './groupSerializers';

/**
 * Checked against the group's own part count, so it needs the group loaded first: the route
 * only bounds the number by the Cevşen's hundred, and a Hizb group has 33.
 */
const validateBabNumber = (babNumber: number, partCount: number): void => {
	if (!Number.isInteger(babNumber) || babNumber < 1 || babNumber > partCount) {
		throw new HttpError(BAD_REQUEST, 'Invalid bab number');
	}
};

/**
 * Nothing is counted before the owner opens day 1 — a lobby member holds a *reserved*
 * range, not a readable one. Without this a group could be finished while still gathering.
 */
const requireRunning = (group: { status: GroupStatus }): void => {
	if (group.status !== 'RUNNING') {
		throw new HttpError(BAD_REQUEST, 'This hatim has not started yet');
	}
};

/**
 * Stamps or clears `completedAt` to match the board. Kept in both directions so
 * unmarking a bab after a round finished doesn't leave the group "completed".
 *
 * Runs on the caller's transaction and decides from the board's current state rather
 * than a `completedAt` value read earlier: a concurrent request finishing (or breaking)
 * the round in between would otherwise make this write the stale answer. The
 * `updateMany` guards keep each branch a single conditional write.
 *
 * The count is taken behind a lock on the group row. Postgres runs on READ COMMITTED, so
 * without it two members finishing the last two babs at the same moment each count while
 * the other's write is still uncommitted, each sees one bab outstanding, and neither
 * stamps the round complete — and since every bab is now read, no later write comes along
 * to correct it. The lock makes the second finisher wait and count the true total.
 */
/**
 * Mirrors a read into `BabRead`, the log that survives the round rollover.
 *
 * `GroupBab` is wiped every round, so it can't answer "how many babs has this member ever
 * read" — the profile's total, streak and heatmap all come from here instead. Undoing a
 * read deletes its entry, scoped to the caller so one member can't erase another's record.
 *
 * `skipDuplicates` rather than an upsert: the unique key is (group, round, bab), so a
 * second write for the same bab in the same round is the no-op re-mark the caller above
 * already treats as success.
 */
const recordRead = async (
	tx: Prisma.TransactionClient,
	input: { babNumbers: number[]; groupId: string; read: boolean; roundIndex: number; userId: string }
): Promise<void> => {
	const { babNumbers, groupId, read, roundIndex, userId } = input;

	if (babNumbers.length === 0) {
		return;
	}

	if (!read) {
		await tx.babRead.deleteMany({
			where: { groupId, roundIndex, babNumber: { in: babNumbers }, userId }
		});

		return;
	}

	await tx.babRead.createMany({
		data: babNumbers.map(babNumber => ({ babNumber, groupId, roundIndex, userId })),
		skipDuplicates: true
	});
};

/**
 * Takes the group row's write lock for the rest of the caller's transaction.
 *
 * Every path that mutates a group's board takes this FIRST, before touching any bab. The
 * rollover locks the group and then the babs, so a path that grabbed babs first would
 * deadlock against it — this keeps one lock order everywhere. Re-taking it inside the same
 * transaction is free, which is why `syncCompletedAt` can call it unconditionally.
 */
export const lockGroup = async (tx: Prisma.TransactionClient, groupId: string): Promise<void> => {
	await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
};

/**
 * Returns **whether this call is the one that closed the hundred** — `true` only on the
 * `null → set` transition, never on a board that was already complete.
 *
 * That answer costs nothing extra: the stamp is a conditional `updateMany` guarded on
 * `completedAt: null`, so its own count already distinguishes "I completed it" from "it was
 * complete when I got here". The lock above means exactly one concurrent finisher can see a
 * count of 1 — the same guarantee that keeps the stamp honest is what keeps the notification
 * from going out twice.
 *
 * It says nothing about whether the group is *told*. Unmarking the last bab and re-marking it
 * closes the board a second time and this returns `true` again — `claimRoundCompleteNotice` is
 * what makes the announcement once per round.
 */
export const syncCompletedAt = async (tx: Prisma.TransactionClient, groupId: string): Promise<boolean> => {
	// Held until the caller's transaction commits. Every path that changes read state goes
	// through here, so this one row is the whole group's serialisation point.
	await lockGroup(tx, groupId);

	const remainingUnread = await tx.groupBab.count({ where: { groupId, readAt: null } });

	if (remainingUnread === 0) {
		const stamped = await tx.group.updateMany({
			where: { id: groupId, completedAt: null },
			data: { completedAt: new Date() }
		});

		return stamped.count === 1;
	}

	await tx.group.updateMany({
		where: { id: groupId, completedAt: { not: null } },
		data: { completedAt: null }
	});

	return false;
};

export const listBabsForUser = async (userId: string, groupId: string): Promise<GroupBab[]> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	await ensureCurrentRoundFor(groupId);

	const babs = await prisma.groupBab.findMany({
		where: { groupId },
		orderBy: { number: 'asc' }
	});

	/*
	 * Named readers, for the group screen's share list — a bab it shows as yours can already
	 * have been read by whoever held that block before you did, and the row says who.
	 *
	 * Only the ids that actually appear, so an untouched board costs no lookup at all. Clerk's
	 * name wins over the stored one, the same order the member list and the pool use: a member
	 * who renamed themselves after joining is still stored under the old name.
	 */
	const readerIds = [...new Set(babs.map(bab => bab.readByUserId).filter(id => id !== null))];
	const nameByUserId = new Map<string, string>();

	if (readerIds.length > 0) {
		const [profiles, members] = await Promise.all([
			getMemberProfiles(readerIds),
			prisma.groupMember.findMany({
				where: { groupId, userId: { in: readerIds } },
				select: { userId: true, displayName: true }
			})
		]);

		for (const member of members) {
			nameByUserId.set(member.userId, member.displayName);
		}
		for (const [id, profile] of profiles) {
			if (profile.displayName) {
				nameByUserId.set(id, profile.displayName);
			}
		}
	}

	return babs.map(bab => serializeBab(bab, nameByUserId));
};

/**
 * Records that this member's finished share has been announced this round, and says whether the
 * caller is the one that recorded it.
 *
 * **Finishing a share is not a one-way door.** Geri al on the last bab and Okudum again makes it
 * true a second time, and the group was told twice for the same range. This is the memory that
 * stops it: one row per member per round, `skipDuplicates` so a second claim is a no-op rather
 * than an error, and `count` as the answer — 1 means this call is the first, 0 means somebody
 * already said it.
 *
 * It runs on the caller's transaction, so the row and the read that completed the share commit
 * together, and the unique key settles the race if two requests finish the same share at once.
 */
const claimShareNotice = async (
	tx: Prisma.TransactionClient,
	roundIndex: number,
	groupId: string,
	userId: string
): Promise<boolean> => {
	const claimed = await tx.shareReadNotice.createMany({
		data: { groupId, roundIndex, userId },
		skipDuplicates: true
	});

	return claimed.count === 1;
};

/**
 * Records that this group's completed round has been announced, and says whether this call is the
 * one that recorded it.
 *
 * **Closing the hundred is not a one-way door**, which is why the stamp alone is not enough to
 * decide: Geri al on the last bab and Okudum again re-closes it, and so does a member leaving or
 * releasing a pool slot — both clear reads — followed by someone re-reading those babs. Each of
 * those is a real `null → set` transition, and without this row each one buzzes the whole group
 * again; a member toggling the last bab could do it at will.
 *
 * Runs on the caller's transaction, so the row and the read that closed the round commit
 * together, and the unique key settles any race the group lock somehow did not.
 */
const claimRoundCompleteNotice = async (
	tx: Prisma.TransactionClient,
	groupId: string,
	roundIndex: number
): Promise<boolean> => {
	const claimed = await tx.roundCompleteNotice.createMany({
		data: { groupId, roundIndex },
		skipDuplicates: true
	});

	return claimed.count === 1;
};

/**
 * Tells the rest of the group that somebody finished their share.
 *
 * **One notification per share, not per bab.** It fired on every read at first, which meant a
 * member working through a thirteen-bab range sent thirteen notifications to everybody who had
 * opted in — one tap of Okudum each, and each its own Expo request. The event worth telling
 * people about is the range being *done*, so this is only reached when the last bab of a share
 * lands, and it names the range rather than a number.
 *
 * **Opt-in, and the flag is read before anything else is looked up.** `groupReadsEnabled`
 * defaults to `false`, so the recipient query usually comes back empty and this returns before
 * touching Clerk or composing anything — which keeps a notification nobody asked for off the
 * hot path.
 *
 * Called **after** the commit and awaited, like the pool-claim push in `groupMembership`: a
 * dangling promise here would escape the request. It also **never throws** — see the `catch`
 * below: the read is already committed by the time this runs, and a failed lookup must not turn
 * a successful write into a 5xx that makes the client roll its optimistic update back.
 *
 * Every recipient's language comes out of the same query as their id — one row each, not a
 * `pushLanguageFor` per person.
 */
const notifyGroupOfShareRead = async (input: { groupId: string; range: string; readerId: string }): Promise<void> => {
	const { groupId, range, readerId } = input;

	try {
		const group = await prisma.group.findUnique({
			where: { id: groupId },
			select: { kind: true, name: true, members: { select: { displayName: true, userId: true } } }
		});

		if (group === null) {
			return;
		}

		const others = group.members.filter(member => member.userId !== readerId);

		if (others.length === 0) {
			return;
		}

		const recipients = await prisma.userSettings.findMany({
			where: { groupReadsEnabled: true, userId: { in: others.map(member => member.userId) } },
			select: { language: true, userId: true }
		});

		// Clerk is the source of truth for a name; `GroupMember.displayName` is written once at
		// join and is the fallback when the lookup comes back empty — see `getMemberProfiles`.
		const profiles = await getMemberProfiles([readerId]);
		const stored = group.members.find(member => member.userId === readerId)?.displayName;
		const readerName = profiles.get(readerId)?.displayName ?? stored ?? FALLBACK_DISPLAY_NAME;

		/*
		 * **Filed for everyone, pushed only to those who asked.** The inbox is the record — the
		 * design's rule is that in-app notifications are always on and the preferences govern
		 * only whether the phone buzzes. So the row goes to every other member; `recipients` is
		 * just who also gets a push.
		 */
		await recordNotification({
			groupId,
			groupName: group.name,
			payload: { kind: 'SHARE_READ', range, readerName },
			userIds: others.map(member => member.userId)
		});

		if (recipients.length === 0) {
			return;
		}

		await Promise.all(
			recipients.map(recipient =>
				sendPushToUser(recipient.userId, {
					...groupReadPush(toPushLanguage(recipient.language), {
						groupName: group.name,
						kind: group.kind,
						range,
						readerName
					}),
					data: { groupId, kind: 'group-read' }
				})
			)
		);
	} catch (error) {
		console.error('Failed to notify a group of a finished share', error);
	}
};

/**
 * The share's range as the notification names it — "1–13", or "1–13, 27–39" once a pool block
 * has been taken on top of it. `babRuns`/`formatRun` are the same helpers the client's share
 * chip uses, so the range in the notification reads the way it does on the group screen.
 */
const shareRange = (babNumbers: number[]): string => babRuns(babNumbers).map(formatRun).join(', ');

/**
 * Tells the group the hundred is closed.
 *
 * **Everyone in the group except whoever finished it**, and no "did you take part" test: the
 * round belongs to the group, and a member who read nothing this time is exactly the person for
 * whom "your group finished without you" is worth knowing. The finisher is excluded for the same
 * reason `notifyGroupOfShareRead` excludes the reader — nobody needs a notification about their
 * own tap.
 *
 * **Opt-out, not opt-in.** `roundCompleteEnabled` defaults to `true`, unlike the bab-by-bab
 * switch: it fires once per round per group — `claimRoundCompleteNotice` guarantees it — and
 * behind an off-by-default setting the app's best moment would reach almost nobody.
 *
 * Called after the commit and awaited, and it never throws — the round is already closed by the
 * time this runs, and a failed lookup must not turn that write into a 5xx.
 */
const notifyGroupOfRoundComplete = async (input: {
	finisherId: string;
	groupId: string;
	groupKind: GroupKindName;
	groupName: string;
	memberIds: string[];
	roundIndex: number;
}): Promise<void> => {
	const { finisherId, groupId, groupKind, groupName, memberIds, roundIndex } = input;

	try {
		/*
		 * **The round and the roster come from the caller's transaction, not a fresh read.** The
		 * rollover is lazy and sits in front of every path that touches a group, so another
		 * member's refetch crossing the boundary in the moment between our commit and a read here
		 * would bump `roundIndex` and blank the board — and this would announce the round that had
		 * just *started* rather than the one that closed. It also saves a query.
		 */
		const others = memberIds.filter(userId => userId !== finisherId);

		if (others.length === 0) {
			return;
		}

		// Filed for everyone in the group but the finisher; pushed only to those who asked.
		await recordNotification({
			groupId,
			groupName,
			payload: { kind: 'ROUND_COMPLETE', roundNumber: roundIndex + 1 },
			userIds: others
		});

		const recipients = await prisma.userSettings.findMany({
			where: { roundCompleteEnabled: true, userId: { in: others } },
			select: { language: true, userId: true }
		});

		/*
		 * A member with no settings row has never opened the app on this account, so there is
		 * nothing to send to — the row is created on first read of the settings, and the default
		 * only applies once it exists.
		 */
		if (recipients.length === 0) {
			return;
		}

		await Promise.all(
			recipients.map(recipient =>
				sendPushToUser(recipient.userId, {
					...roundCompletePush(toPushLanguage(recipient.language), {
						groupName,
						kind: groupKind,
						// Stored from zero; the group screen and Turlar both count from one.
						roundNumber: roundIndex + 1
					}),
					data: { groupId, kind: 'round-complete' }
				})
			)
		);
	} catch (error) {
		console.error('Failed to notify a group that its round completed', error);
	}
};

export const setBabReadForUser = async (
	userId: string,
	groupId: string,
	babNumber: number,
	read: boolean
): Promise<GroupBab> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	// Everything from here happens in ONE transaction, and it opens by locking the group
	// row. Two reasons, both load-bearing:
	//
	// 1. The round must not move underneath us. Rolling in a separate transaction left a
	//    window where a boundary passed between the roll and the write — the read landed on
	//    the new board but was logged under the old round.
	// 2. Lock ORDER. The rollover takes the group row and then the babs; if this path took
	//    babs first and only reached the group inside `syncCompletedAt`, the two would
	//    deadlock. Taking the group first makes the order identical everywhere.
	const outcome = await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
		validateBabNumber(babNumber, partCountFor(group.kind));
		requireRunning(group);

		// Under ROTATION the babs a member may mark this round are their seat's *rotated*
		// block, not the ones carrying their `assignedUserId` — those coincide only in round 0.
		//
		// The one thing they may also mark is a pool slot they took, which sits outside the
		// rotation. That has to be checked against the pool specifically, not against
		// `assignedUserId` alone: a member's own standing seat carries their id too, and in
		// any later round that block belongs to whoever the rotation handed it to.
		const share = shareBabNumbersToday(group, group.members, normalizedUserId);
		const isMine = share.includes(babNumber);
		const isPool = poolBabNumbers(group, group.members, group.roundIndex).includes(babNumber);

		if (!isMine && !isPool) {
			throw new HttpError(CONFLICT, 'This bab is not yours to mark today');
		}

		const where: Prisma.GroupBabWhereInput = isMine
			? { groupId, number: babNumber }
			: { groupId, number: babNumber, assignedUserId: normalizedUserId };

		// Undoing only ever clears the caller's own read. A rotated bab may already have been
		// read by whoever held that block in an earlier round, and this round's holder must
		// not be able to erase it.
		const undoWhere: Prisma.GroupBabWhereInput = { ...where, readByUserId: normalizedUserId };

		// Re-stamping an already-read bab would move a historical read to today and invent
		// streak/heatmap activity, so marking-as-read only matches rows that are still unread.
		// A repeated mark is then a no-op rather than a conflict.
		const result = await tx.groupBab.updateMany({
			where: read ? { ...where, readAt: null } : undoWhere,
			// Reading never rewrites `assignedUserId`: that field records which seat owns the
			// bab, and under ROTATION the reader is holding a different seat today. Taking
			// ownership is what the pool's "Üstlen" is for.
			data: read ? { readByUserId: normalizedUserId, readAt: new Date() } : { readByUserId: null, readAt: null }
		});

		if (result.count === 0) {
			const current = await tx.groupBab.findUniqueOrThrow({
				where: { groupId_number: { groupId, number: babNumber } }
			});
			const isAlreadyInDesiredState = read
				? current.readByUserId === normalizedUserId && current.readAt !== null
				: current.readAt === null;

			if (!isAlreadyInDesiredState) {
				throw new HttpError(CONFLICT, 'This bab is not assigned to you');
			}

			// A no-op re-mark, so nothing changed and nobody is told about it.
			return {
				bab: current,
				didCompleteRound: false,
				groupKind: group.kind,
				groupName: group.name,
				isShareRead: false,
				memberIds: group.members.map(member => member.userId),
				roundIndex: group.roundIndex,
				share
			};
		}

		await recordRead(tx, {
			babNumbers: [babNumber],
			groupId,
			read,
			roundIndex: group.roundIndex,
			userId: normalizedUserId
		});

		// Announced once per round — see `claimRoundCompleteNotice`.
		const didCompleteRound =
			(await syncCompletedAt(tx, groupId)) && (await claimRoundCompleteNotice(tx, groupId, group.roundIndex));

		/*
		 * **Did this read finish the share?** That is the event the group is told about — one
		 * notification for a range, not one per bab — so the question is asked here, where the
		 * share and the board are already in hand and inside the same transaction that wrote the
		 * read. Only on a real new read, and only for a bab **in the share**: a pool bab read after
		 * the share was already finished would otherwise find nothing outstanding and announce the
		 * same range a second time.
		 */
		const unreadInShare =
			read && isMine && share.length > 0
				? await tx.groupBab.count({ where: { groupId, number: { in: share }, readAt: null } })
				: 1;

		return {
			bab: await tx.groupBab.findUniqueOrThrow({ where: { groupId_number: { groupId, number: babNumber } } }),
			didCompleteRound,
			groupKind: group.kind,
			groupName: group.name,
			memberIds: group.members.map(member => member.userId),
			roundIndex: group.roundIndex,
			isShareRead:
				unreadInShare === 0 && (await claimShareNotice(tx, group.roundIndex, groupId, normalizedUserId)),
			share
		};
	});

	/*
	 * **Only the bigger news.** A tap that closes the hundred usually closes a share too, and
	 * sending both would tell the group twice about one moment — "Ahmet finished babs 1–13" and
	 * "Round 13 is complete" a second apart. The round is the thing that happened; the share is
	 * how it happened. It also halves the work hanging off the slowest write in the app.
	 */
	if (outcome.isShareRead && !outcome.didCompleteRound) {
		await notifyGroupOfShareRead({
			groupId,
			range: shareRange(outcome.share),
			readerId: normalizedUserId
		});
	}

	if (outcome.didCompleteRound) {
		await notifyGroupOfRoundComplete({
			finisherId: normalizedUserId,
			groupId,
			groupKind: outcome.groupKind,
			groupName: outcome.groupName,
			memberIds: outcome.memberIds,
			roundIndex: outcome.roundIndex
		});
	}

	return serializeBab(outcome.bab);
};

/**
 * Marks every bab assigned to the caller at once — the Home screen's primary action
 * is "I have read my whole share", and looping the single-bab endpoint would fire one
 * request per bab (up to 20) for a single tap.
 *
 * Only unread rows are stamped, for the same reason the single-bab path skips them:
 * re-stamping would move earlier reads to today and inflate the streak.
 */
export const setAssignedBabsReadForUser = async (
	userId: string,
	groupId: string,
	read: boolean
): Promise<GroupBab[]> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	// One transaction, group lock first — see the single-bab path for why both matter.
	const result = await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
		requireRunning(group);

		/*
		 * Everything the caller is holding this round: the rotated block *and* the pool blocks
		 * they volunteered for — exactly the set the client calls `myBabNumbers`.
		 *
		 * The rotated block alone used to be the rule, on the reasoning that a volunteered
		 * block is extra and one tap shouldn't mark more than the screen offered. That reading
		 * was overtaken by the screen: Home's ring counts the whole share and says "33 bab · Bu
		 * grubu bitir" over it. Marking seventeen of those thirty-three looked, to the person
		 * who tapped it, like nothing had happened.
		 *
		 * Rotated rather than the seat's standing block, so this never touches a block the
		 * rotation has handed to somebody else this round. The claim half is read off
		 * `assignedUserId`, which means only this round's claims — the rollover clears it.
		 */
		const shareNumbers = shareBabNumbersToday(group, group.members, normalizedUserId);
		/*
		 * The claim half is intersected with this round's pool, exactly as the single-bab path
		 * checks `isPool` rather than trusting `assignedUserId` alone.
		 *
		 * A claim should never outlive the round that made it — the rollover clears the whole
		 * column and joining a seat clears the block it was offering — so in practice this
		 * changes nothing. It is here because the one write that could prove that wrong is this
		 * one: unmarking deletes `BabRead` rows, and history deleted for a block that turned out
		 * not to be the caller's is not recoverable. A stale claim should cost a bab that stays
		 * unread, never somebody else's record.
		 */
		const poolNumbers = new Set(poolBabNumbers(group, group.members, group.roundIndex));
		const claimed = await tx.groupBab.findMany({
			where: { groupId, assignedUserId: normalizedUserId },
			select: { number: true }
		});
		const numbers = [
			...new Set([...shareNumbers, ...claimed.map(bab => bab.number).filter(number => poolNumbers.has(number))])
		];

		const mine: Prisma.GroupBabWhereInput = { groupId, number: { in: numbers } };

		// Captured before the write, so the log records exactly the rows this call changed
		// rather than everything that happens to be read now.
		const affected = await tx.groupBab.findMany({
			where: read ? { ...mine, readAt: null } : { ...mine, readByUserId: normalizedUserId },
			select: { number: true }
		});

		await tx.groupBab.updateMany({
			// Clearing is scoped to the caller's own reads — see the single-bab path.
			where: read ? { ...mine, readAt: null } : { ...mine, readByUserId: normalizedUserId },
			data: read ? { readByUserId: normalizedUserId, readAt: new Date() } : { readByUserId: null, readAt: null }
		});

		await recordRead(tx, {
			babNumbers: affected.map(bab => bab.number),
			groupId,
			read,
			roundIndex: group.roundIndex,
			userId: normalizedUserId
		});

		const didCompleteRound =
			(await syncCompletedAt(tx, groupId)) && (await claimRoundCompleteNotice(tx, groupId, group.roundIndex));

		// The same question the single-bab path asks, and the same answer shape. Marking a whole
		// share finishes it by definition — unless nothing was left to mark, which is a re-tap
		// and not news.
		const unreadInShare =
			read && numbers.length > 0
				? await tx.groupBab.count({ where: { groupId, number: { in: numbers }, readAt: null } })
				: 1;

		return {
			babs: await tx.groupBab.findMany({ where: { groupId }, orderBy: { number: 'asc' } }),
			didCompleteRound,
			groupKind: group.kind,
			groupName: group.name,
			memberIds: group.members.map(member => member.userId),
			roundIndex: group.roundIndex,
			isShareRead:
				unreadInShare === 0 &&
				affected.length > 0 &&
				(await claimShareNotice(tx, group.roundIndex, groupId, normalizedUserId)),
			share: numbers
		};
	});

	/*
	 * **Only the bigger news.** A tap that closes the hundred usually closes a share too, and
	 * sending both would tell the group twice about one moment — "Ahmet finished babs 1–13" and
	 * "Round 13 is complete" a second apart. The round is the thing that happened; the share is
	 * how it happened. It also halves the work hanging off the slowest write in the app.
	 */
	if (result.isShareRead && !result.didCompleteRound) {
		await notifyGroupOfShareRead({
			groupId,
			range: shareRange(result.share),
			readerId: normalizedUserId
		});
	}

	if (result.didCompleteRound) {
		await notifyGroupOfRoundComplete({
			finisherId: normalizedUserId,
			groupId,
			groupKind: result.groupKind,
			groupName: result.groupName,
			memberIds: result.memberIds,
			roundIndex: result.roundIndex
		});
	}

	return result.babs.map(bab => serializeBab(bab));
};
