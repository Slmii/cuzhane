import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';
import { lockGroup, syncCompletedAt } from './babs.service';
import { getMemberProfiles } from '@utils/memberProfiles';
import { notifyGroupMembers } from './groupEvents.service';
import { settingFor } from '@utils/notificationSettings';
import { poolClaimPush } from '@utils/pushCopy';
import { babRuns, formatRun } from '@utils/babs';
import { requireMembership } from './groupAccess.service';
import { poolBlocks } from './groupSerializers';
import { ensureCurrentRound, ensureCurrentRoundFor } from './rounds.service';

/**
 * The shared pool is the share of the seats nobody took. A slot is offered whole rather
 * than bab by bab, so taking one mirrors what joining that seat would have handed you.
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
				takenByUserId,
				// Clerk's name first, the stored one second — a member who set their name after
				// joining is still stored under whatever their claims held on the day.
				takenByDisplayName: takenByUserId
					? profiles.get(takenByUserId)?.displayName ?? nameByUserId.get(takenByUserId) ?? null
					: null,
				takenByImageUrl: takenByUserId ? profiles.get(takenByUserId)?.imageUrl ?? null : null,
				takenByMe: takenByUserId === normalizedUserId,
				readCount: babs.filter(bab => bab.readAt !== null).length,
				readBabNumbers: babs.filter(bab => bab.readAt !== null).map(bab => bab.number)
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
	group: { spots: number; splitMode: 'ROTATION' | 'FIXED' | 'FREE'; roundIndex: number },
	members: { slotIndex: number }[],
	slotIndex: number
): number[] | null =>
	poolBlocks(group, members, group.roundIndex).find(b => b.slotIndex === slotIndex)?.babNumbers ?? null;

/**
 * Takes a whole pool slot on top of the caller's own share, for this round only.
 *
 * The write is a conditional `updateMany` guarded on `assignedUserId: null`, the same
 * shape the claim paths use: two members tapping "Üstlen" at once cannot both win,
 * because the loser's update matches zero rows.
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

		/*
		 * **A hatim's havuz is `cuzPool.service`, not this.** This path hands out a seat's block of
		 * the hundred, and on thirty cüz that maths means nothing — yet it went through: the app
		 * never called it for a hatim, but a direct request could, and the next joiner then
		 * "released" the claim in bab wording. Refused at the door instead.
		 */
		if (group.kind === 'HATIM') {
			throw new HttpError(BAD_REQUEST, 'A hatim takes cüz from its cüz havuz, not seats from this pool');
		}

		const babNumbers = poolBlockFor(group, group.members, slotIndex);

		if (!babNumbers) {
			throw new HttpError(BAD_REQUEST, 'That seat is not in the pool');
		}

		const claimed = await tx.groupBab.updateMany({
			where: { groupId, number: { in: babNumbers }, assignedUserId: null },
			data: { assignedUserId: normalizedUserId }
		});

		if (claimed.count === 0) {
			throw new HttpError(CONFLICT, 'Someone already took that slot');
		}

		takenBabNumbers = babNumbers;
		groupName = group.name;
	});

	/*
	 * After the commit, and awaited — an unawaited rejection would escape the request as an
	 * unhandled one. The claim is already recorded by the time this runs, so `notifyGroupMembers`
	 * swallowing its own failures is what keeps a courtesy from failing the write.
	 */
	if (takenBabNumbers.length > 0 && groupName !== null) {
		const range = babRuns(takenBabNumbers).map(formatRun).join(', ');

		await notifyGroupMembers({
			actorUserId: normalizedUserId,
			// The lookup used to be here; it lives in the helper now, so all three events resolve
			// a name the same way rather than one of them doing it properly and two not.
			build: ({ actorName, groupName: name }) => ({
				payload: { kind: 'POOL_BAB_CLAIMED', range, takerName: actorName },
				push: language =>
					poolClaimPush(language, { groupName: name, kind: 'CEVSEN', range, takerName: actorName })
			}),
			excludeUserIds: [normalizedUserId],
			groupId,
			pushKind: 'pool-claim',
			/*
			 * **Hard-coded to the Cevşen switch, because this path is seat machinery.** The whole
			 * of `pool.service` works in `slotIndex` and blocks, which a hatim does not have — its
			 * spare cüz are taken a different way (Q3, unbuilt). When that lands it calls
			 * `settingFor('poolClaim', kind)` rather than adding a branch here.
			 */
			setting: settingFor('poolClaim', 'CEVSEN'),
			subject: String(slotIndex)
		});
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
