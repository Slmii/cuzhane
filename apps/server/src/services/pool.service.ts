import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';
import { syncCompletedAt } from './babs.service';
import { getMemberProfiles } from '@utils/memberProfiles';
import { notifyGroupMembers } from './groupEvents.service';
import { poolClaimPush } from '@utils/pushCopy';
import { babRuns, formatRun } from '@utils/babs';
import { partCountFor } from '@utils/groupKinds';
import { requireMembership } from './groupAccess.service';
import { poolBabNumbers, poolBlocks } from './groupSerializers';
import { ensureCurrentRound, ensureCurrentRoundFor, lockGroup } from './rounds.service';
import type { Group } from '../generated/prisma/client';

/**
 * The shared pool is the share of the seats nobody took. A slot is offered whole rather
 * than bab by bab, so taking one mirrors what joining that seat would have handed you — and
 * in a Hizb group a portion at a time as well, via `takePoolPartForUser`.
 *
 * `slotIndex` is the empty *seat*; the babs are that seat's block **for the current
 * round**, which under ROTATION is not the seat's standing block — see `poolBlocks`.
 */
export type PoolSlot = {
	slotIndex: number;
	start: number;
	end: number;
	babNumbers: number[];
	/** Null while the slot is still unclaimed. */
	takenByUserId: string | null;
	takenByDisplayName: string | null;
	/** The taker's profile photo, when they have one — members only, like the member list. */
	takenByImageUrl: string | null;
	takenByMe: boolean;
	readCount: number;
	/**
	 * Which of this slot's babs have been read, by number.
	 *
	 * `readCount` answers "how far has this block got" for the slot's own row; the board above
	 * it colours one cell per bab, and a count cannot say *which*. Without this the Havuz
	 * board could only show a block as claimed or not, so a block someone had taken and
	 * finished looked exactly like one they had taken and not started.
	 */
	readBabNumbers: number[];
	/**
	 * Who holds each of the slot's parts, in order.
	 *
	 * A Cevşen slot is taken whole, so every part names the same taker. A Hizb slot can be
	 * taken a portion at a time, by several members, and this is the only place the Havuz
	 * screen can learn which portion is whose — the slot-level `takenBy*` fields above name
	 * only the first claimant.
	 */
	parts: {
		number: number;
		takenByUserId: string | null;
		takenByDisplayName: string | null;
		takenByImageUrl: string | null;
		takenByMe: boolean;
		isRead: boolean;
	}[];
};

export const listPoolSlotsForUser = async (userId: string, groupId: string): Promise<PoolSlot[]> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	// Without this the list would advertise the expired round's blocks, and a claim made
	// against them would be released moments later by the first request that did roll.
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		include: { members: true, babs: true }
	});

	const babByNumber = new Map(group.babs.map(bab => [bab.number, bab]));
	const nameByUserId = new Map(group.members.map(member => [member.userId, member.displayName]));
	const profiles = await getMemberProfiles(group.members.map(member => member.userId));

	// Clerk's name first, the stored one second — a member who set their name after joining is
	// still stored under whatever their claims held on the day.
	const takerOf = (userId: string | null) => ({
		takenByUserId: userId,
		takenByDisplayName: userId ? profiles.get(userId)?.displayName ?? nameByUserId.get(userId) ?? null : null,
		takenByImageUrl: userId ? profiles.get(userId)?.imageUrl ?? null : null,
		takenByMe: userId === normalizedUserId
	});

	return poolBlocks(group, group.members, group.roundIndex).flatMap(block => {
		const babs = block.babNumbers.map(number => babByNumber.get(number)).filter(bab => bab !== undefined);

		if (babs.length === 0) {
			return [];
		}

		// A slot counts as taken when someone holds its babs — they were unassigned until then.
		const takenByUserId = babs.find(bab => bab.assignedUserId !== null)?.assignedUserId ?? null;

		return [
			{
				slotIndex: block.slotIndex,
				start: block.babNumbers[0] as number,
				end: block.babNumbers[block.babNumbers.length - 1] as number,
				babNumbers: block.babNumbers,
				...takerOf(takenByUserId),
				readCount: babs.filter(bab => bab.readAt !== null).length,
				readBabNumbers: babs.filter(bab => bab.readAt !== null).map(bab => bab.number),
				parts: babs.map(bab => ({
					number: bab.number,
					...takerOf(bab.assignedUserId),
					isRead: bab.readAt !== null
				}))
			}
		];
	});
};

/**
 * The pool block a seat is offering this round, or null if that seat isn't in the pool.
 *
 * Exported for the join path, which has to release whatever was volunteered for the seat
 * it hands out. Sharing this one answer is the point: computed separately the two would
 * eventually disagree about which block a seat offers, and the join would clear the wrong
 * babs — leaving the claim it meant to release and voiding one it didn't.
 */
export const poolBlockFor = (
	// `kind` because the block is a share of the group's own part count, not of a hundred.
	group: Pick<Group, 'spots' | 'splitMode' | 'kind' | 'roundIndex'>,
	members: { slotIndex: number }[],
	slotIndex: number
): number[] | null =>
	poolBlocks(group, members, group.roundIndex).find(b => b.slotIndex === slotIndex)?.babNumbers ?? null;

/**
 * Tells the rest of the group what the caller just took out of the pool.
 *
 * Called after the commit, and awaited — an unawaited rejection would escape the request as an
 * unhandled one. The claim is already recorded by the time this runs, so `notifyGroupMembers`
 * swallowing its own failures is what keeps a courtesy from failing the write.
 */
const notifyPoolClaim = async (takerUserId: string, groupId: string, babNumbers: number[]): Promise<void> => {
	const range = babRuns(babNumbers).map(formatRun).join(', ');

	await notifyGroupMembers({
		actorUserId: takerUserId,
		// The lookup used to be here; it lives in the helper now, so all three events resolve
		// a name the same way rather than one of them doing it properly and two not.
		build: ({ actorName, groupName, kind }) => ({
			payload: { kind: 'POOL_BAB_CLAIMED', range, takerName: actorName },
			push: language => poolClaimPush(language, { groupName, kind, range, takerName: actorName })
		}),
		excludeUserIds: [takerUserId],
		groupId,
		pushKind: 'pool-claim',
		setting: 'poolClaimEnabled'
	});
};

/**
 * Takes a whole pool slot on top of the caller's own share, for this round only.
 *
 * The write is a conditional `updateMany` guarded on `assignedUserId: null`, the same
 * shape the claim paths use: two members tapping "Üstlen" at once cannot both win,
 * because the loser's update matches zero rows.
 *
 * In a Hizb group somebody may already hold a portion of the slot (`takePoolPartForUser`),
 * so "whole" means whatever of it is still free — and the notice names exactly that, not the
 * block, which would announce a portion somebody else took as the caller's.
 */
export const takePoolSlotForUser = async (
	userId: string,
	groupId: string,
	slotIndex: number
): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	// Carried out of the transaction for the notification below, which must not run inside it.
	let takenBabNumbers: number[] = [];
	let groupName: string | null = null;

	await prisma.$transaction(async tx => {
		// Group lock first, then babs — the order every mutating path uses, so this can't
		// deadlock against a rollover running at the same moment.
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });

		if (group.status !== 'RUNNING') {
			throw new HttpError(BAD_REQUEST, 'The pool opens when the hatim starts');
		}

		const babNumbers = poolBlockFor(group, group.members, slotIndex);

		if (!babNumbers) {
			throw new HttpError(BAD_REQUEST, 'That seat is not in the pool');
		}

		// Read under the group lock every claim path takes first, so nothing can claim one of
		// these between the read and the write below.
		const free = await tx.groupBab.findMany({
			where: { groupId, number: { in: babNumbers }, assignedUserId: null },
			select: { number: true }
		});
		const freeNumbers = free.map(bab => bab.number);

		const claimed = await tx.groupBab.updateMany({
			where: { groupId, number: { in: freeNumbers }, assignedUserId: null },
			data: { assignedUserId: normalizedUserId }
		});

		if (claimed.count === 0) {
			throw new HttpError(CONFLICT, 'Someone already took that slot');
		}

		takenBabNumbers = freeNumbers;
		groupName = group.name;
	});

	// After the commit — see `notifyPoolClaim`.
	if (takenBabNumbers.length > 0 && groupName !== null) {
		await notifyPoolClaim(normalizedUserId, groupId, takenBabNumbers);
	}

	return { success: true };
};

/** Puts a slot the caller took back in the pool, along with any progress on it. */
export const releasePoolSlotForUser = async (
	userId: string,
	groupId: string,
	slotIndex: number
): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
		const babNumbers = poolBlockFor(group, group.members, slotIndex);

		if (!babNumbers) {
			throw new HttpError(BAD_REQUEST, 'That seat is not in the pool');
		}

		// Giving the slot back and un-reading it are two different scopes. A ROTATION group
		// cycles every member through every seat's block, including the empty ones, so a bab
		// in this slot may have been read by someone else in an earlier round — clearing that
		// would erase a stranger's progress. Only the releaser's own reads come off.
		const mine = await tx.groupBab.findMany({
			where: {
				groupId,
				number: { in: babNumbers },
				assignedUserId: normalizedUserId,
				readByUserId: normalizedUserId
			},
			select: { number: true }
		});

		await tx.groupBab.updateMany({
			where: {
				groupId,
				number: { in: babNumbers },
				assignedUserId: normalizedUserId,
				readByUserId: normalizedUserId
			},
			data: { readByUserId: null, readAt: null }
		});

		// The history entry goes with the read it describes. Leaving it behind would let the
		// profile count a bab the board no longer shows as read — the same rule the
		// mark/unmark path follows.
		if (mine.length > 0) {
			await tx.babRead.deleteMany({
				where: {
					groupId,
					roundIndex: group.roundIndex,
					babNumber: { in: mine.map(bab => bab.number) },
					userId: normalizedUserId
				}
			});
		}

		await tx.groupBab.updateMany({
			where: { groupId, number: { in: babNumbers }, assignedUserId: normalizedUserId },
			data: { assignedUserId: null }
		});

		// Releasing can un-complete the group, so the sync runs in the same transaction as
		// the write that changed the read state — never after it.
		await syncCompletedAt(tx, groupId);
	});

	return { success: true };
};

/**
 * A Hizb pool is offered a portion at a time; a Cevşen one is not.
 *
 * A Cevşen block is five babs at the least and is taken whole — that rule stands. A Hizb
 * block can be a single portion already, and the portions are long enough that covering one
 * of a block's three is a real contribution, so several members may split an empty seat's
 * block between them.
 */
const requirePartsPool = (group: Pick<Group, 'kind'>): void => {
	if (group.kind !== 'HIZB') {
		throw new HttpError(BAD_REQUEST, 'Cevşen pool slots are taken whole');
	}
};

/** The number is one of the group's parts and sits in this round's pool — or the request is refused. */
const requireInPool = (
	group: Pick<Group, 'spots' | 'splitMode' | 'kind' | 'roundIndex'>,
	members: { slotIndex: number }[],
	babNumber: number
): void => {
	const isPart = Number.isInteger(babNumber) && babNumber >= 1 && babNumber <= partCountFor(group.kind);

	if (!isPart || !poolBabNumbers(group, members, group.roundIndex).includes(babNumber)) {
		throw new HttpError(BAD_REQUEST, 'That portion is not in the pool');
	}
};

/**
 * Takes one portion of a Hizb pool block on top of the caller's share, for this round only.
 *
 * The same conditional `updateMany` the slot path uses, narrowed to one row: two members
 * tapping the same portion at once cannot both win, because the loser's update matches zero
 * rows. Two members taking *different* portions of one block both succeed — which is the
 * point — and a join into that seat later releases each of them (see `attemptJoin`).
 */
export const takePoolPartForUser = async (
	userId: string,
	groupId: string,
	babNumber: number
): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	await prisma.$transaction(async tx => {
		// Group lock first, then babs — see `takePoolSlotForUser`.
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
		requirePartsPool(group);

		if (group.status !== 'RUNNING') {
			throw new HttpError(BAD_REQUEST, 'The pool opens when the hatim starts');
		}

		requireInPool(group, group.members, babNumber);

		const claimed = await tx.groupBab.updateMany({
			where: { groupId, number: babNumber, assignedUserId: null },
			data: { assignedUserId: normalizedUserId }
		});

		if (claimed.count === 0) {
			throw new HttpError(CONFLICT, 'Someone already took that portion');
		}
	});

	await notifyPoolClaim(normalizedUserId, groupId, [babNumber]);

	return { success: true };
};

/**
 * Puts one portion the caller took back in the pool, along with their read of it.
 *
 * `releasePoolSlotForUser` narrowed to a single number, and for the same reasons: only the
 * caller's own claim and own read come off, and the sync runs in the same transaction. A
 * portion the caller does not hold is left as it is and answered as success, exactly as the
 * slot release answers for a slot that is not theirs.
 */
export const releasePoolPartForUser = async (
	userId: string,
	groupId: string,
	babNumber: number
): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
		requirePartsPool(group);
		requireInPool(group, group.members, babNumber);

		const mine = { groupId, number: babNumber, assignedUserId: normalizedUserId };
		const unread = await tx.groupBab.updateMany({
			where: { ...mine, readByUserId: normalizedUserId },
			data: { readByUserId: null, readAt: null }
		});

		// The history entry goes with the read it describes — see `releasePoolSlotForUser`.
		if (unread.count > 0) {
			await tx.babRead.deleteMany({
				where: { groupId, roundIndex: group.roundIndex, babNumber, userId: normalizedUserId }
			});
		}

		await tx.groupBab.updateMany({ where: mine, data: { assignedUserId: null } });

		// Releasing a read portion can un-complete the round.
		await syncCompletedAt(tx, groupId);
	});

	return { success: true };
};

/**
 * Acknowledges the "a joiner took over the block you volunteered for" notices in a group.
 *
 * Marking rather than deleting: the row is the only record that the claim existed, and it
 * is the *notice* being dismissed, not the fact.
 */
export const markPoolReleasesSeenForUser = async (userId: string, groupId: string): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	await prisma.poolClaimRelease.updateMany({
		where: { groupId, userId: normalizedUserId, seenAt: null },
		data: { seenAt: new Date() }
	});

	return { success: true };
};
