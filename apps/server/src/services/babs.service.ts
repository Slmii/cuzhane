import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { BAB_COUNT } from '@utils/babs';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Prisma } from '../generated/prisma/client';
import { requireMembership } from './groupAccess.service';
import { poolBabNumbers, serializeBab, shareBabNumbersToday } from './groupSerializers';
import { ensureCurrentRound, ensureCurrentRoundFor } from './rounds.service';
import type { GroupBab, GroupStatus } from './groupSerializers';

const validateBabNumber = (babNumber: number): void => {
	if (!Number.isInteger(babNumber) || babNumber < 1 || babNumber > BAB_COUNT) {
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

export const syncCompletedAt = async (tx: Prisma.TransactionClient, groupId: string): Promise<void> => {
	// Held until the caller's transaction commits. Every path that changes read state goes
	// through here, so this one row is the whole group's serialisation point.
	await lockGroup(tx, groupId);

	const remainingUnread = await tx.groupBab.count({ where: { groupId, readAt: null } });

	if (remainingUnread === 0) {
		await tx.group.updateMany({
			where: { id: groupId, completedAt: null },
			data: { completedAt: new Date() }
		});

		return;
	}

	await tx.group.updateMany({
		where: { id: groupId, completedAt: { not: null } },
		data: { completedAt: null }
	});
};

export const listBabsForUser = async (userId: string, groupId: string): Promise<GroupBab[]> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	await ensureCurrentRoundFor(groupId);

	const babs = await prisma.groupBab.findMany({
		where: { groupId },
		orderBy: { number: 'asc' }
	});

	return babs.map(serializeBab);
};

export const setBabReadForUser = async (
	userId: string,
	groupId: string,
	babNumber: number,
	read: boolean
): Promise<GroupBab> => {
	validateBabNumber(babNumber);

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
	const bab = await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
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

			return current;
		}

		await recordRead(tx, {
			babNumbers: [babNumber],
			groupId,
			read,
			roundIndex: group.roundIndex,
			userId: normalizedUserId
		});

		await syncCompletedAt(tx, groupId);

		return tx.groupBab.findUniqueOrThrow({ where: { groupId_number: { groupId, number: babNumber } } });
	});

	return serializeBab(bab);
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
	const babs = await prisma.$transaction(async tx => {
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

		await syncCompletedAt(tx, groupId);

		return tx.groupBab.findMany({ where: { groupId }, orderBy: { number: 'asc' } });
	});

	return babs.map(serializeBab);
};
