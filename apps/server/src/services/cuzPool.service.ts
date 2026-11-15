import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { getMemberProfiles } from '@utils/memberProfiles';
import { normalizeUserId } from '@utils/normalizeUserId';
import { settingFor } from '@utils/notificationSettings';
import { poolClaimPush } from '@utils/pushCopy';
import { CUZ_COUNT } from '@utils/units';
import { syncCompletedAt } from './babs.service';
import { lockGroup } from './rounds.service';
import { requireMembership } from './groupAccess.service';
import { notifyGroupMembers } from './groupEvents.service';
import { ensureCurrentRound, ensureCurrentRoundFor } from './rounds.service';

/**
 * **The hatim's havuz: the cüz nobody joined with.**
 *
 * The Cevşen pool is seat arithmetic — a slot is an empty *seat's* block, offered whole. A
 * hatim has no such thing: its thirty seats are a ceiling on `slotIndex` and divide nothing,
 * and a cüz is taken one at a time. So this is a parallel service rather than a branch inside
 * `pool.service`, which works in `slotIndex` from end to end.
 *
 * What the two share is the meaning: **taking one is a loan.** It covers the round it was
 * made in and goes back at the boundary whatever the group's `boundaryPolicy` says — the
 * same promise a Cevşen claim makes, where the rollover clears `assignedUserId` outright.
 * `CuzHolding.isLoan` is what carries that, and the rollover is what honours it.
 */
export type PoolCuz = {
	cuzNumber: number;
	/** Null while nobody has taken it — the hatched cell. */
	takenByUserId: string | null;
	takenByDisplayName: string | null;
	/** The taker's profile photo, when they have one — members only, like the member list. */
	takenByImageUrl: string | null;
	takenByMe: boolean;
	/** Whether it has been read this round, so a taken cüz can show it has been finished. */
	isRead: boolean;
};

const requireHatim = (group: { kind: string }): void => {
	if (group.kind !== 'HATIM') {
		throw new HttpError(BAD_REQUEST, 'This group does not read cüz');
	}
};

/**
 * The havuz, as rows: every cüz nobody holds, **plus the ones borrowed out of it this
 * round**.
 *
 * The loans have to stay in the list or they would vanish the moment they were taken, and
 * with them the only way to hand one back — the Cevşen screen keeps a claimed slot listed
 * for exactly the same reason. A cüz somebody *joined* with was never in the havuz and is
 * not here: it is their own, not a favour.
 */
export const listPoolCuzForUser = async (userId: string, groupId: string): Promise<PoolCuz[]> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	// Without this the list would advertise the expired round's holdings, and a take against
	// them would be released moments later by the first request that did roll.
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		include: { members: true, babs: true }
	});

	requireHatim(group);

	const holdings = await prisma.cuzHolding.findMany({
		where: { groupId, roundIndex: group.roundIndex }
	});
	const holdingByNumber = new Map(holdings.map(holding => [holding.cuzNumber, holding]));
	const readNumbers = new Set(group.babs.filter(bab => bab.readAt !== null).map(bab => bab.number));

	const nameByUserId = new Map(group.members.map(member => [member.userId, member.displayName]));
	const profiles = await getMemberProfiles(holdings.filter(holding => holding.isLoan).map(holding => holding.userId));

	return Array.from({ length: CUZ_COUNT }, (_, index) => index + 1)
		.filter(cuzNumber => {
			const holding = holdingByNumber.get(cuzNumber);

			return holding === undefined || holding.isLoan;
		})
		.map(cuzNumber => {
			const holding = holdingByNumber.get(cuzNumber);

			if (holding === undefined) {
				return {
					cuzNumber,
					isRead: readNumbers.has(cuzNumber),
					takenByDisplayName: null,
					takenByImageUrl: null,
					takenByMe: false,
					takenByUserId: null
				};
			}

			// Clerk first, the seat's stored name second — the order every named row uses.
			const profile = profiles.get(holding.userId);

			return {
				cuzNumber,
				isRead: readNumbers.has(cuzNumber),
				takenByDisplayName: profile?.displayName ?? nameByUserId.get(holding.userId) ?? null,
				takenByImageUrl: profile?.imageUrl ?? null,
				takenByMe: holding.userId === normalizedUserId,
				takenByUserId: holding.userId
			};
		});
};

/** Takes one cüz out of the havuz for the rest of this round. */
export const takePoolCuzForUser = async (
	userId: string,
	groupId: string,
	cuzNumber: number
): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	if (!Number.isInteger(cuzNumber) || cuzNumber < 1 || cuzNumber > CUZ_COUNT) {
		throw new HttpError(BAD_REQUEST, 'Invalid cüz number');
	}

	let groupName: string | null = null;

	await prisma.$transaction(async tx => {
		// Group lock first, then holdings — the order every mutating path uses, so this can't
		// deadlock against a rollover running at the same moment.
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });

		requireHatim(group);

		if (group.status !== 'RUNNING') {
			throw new HttpError(BAD_REQUEST, 'The pool opens when the hatim starts');
		}

		/*
		 * **A loan counts against the cap.** The cap is what one person may hold in a round,
		 * and a borrowed cüz is held: without this, a group capped at one could be read
		 * entirely by whoever tapped fastest, one loan at a time.
		 */
		if (group.maxPerMember !== null) {
			const held = await tx.cuzHolding.count({
				where: { groupId, roundIndex: group.roundIndex, userId: normalizedUserId }
			});

			if (held >= group.maxPerMember) {
				throw new HttpError(BAD_REQUEST, `You may hold at most ${group.maxPerMember} cüz in this group`);
			}
		}

		/*
		 * `createMany` with `skipDuplicates` rather than a read-then-write: the unique key
		 * `(groupId, roundIndex, cuzNumber)` is the guard two simultaneous takers lose against,
		 * exactly as the Cevşen claim's conditional `updateMany` is. A count of zero means
		 * somebody else already holds it.
		 */
		const created = await tx.cuzHolding.createMany({
			data: [{ cuzNumber, groupId, isLoan: true, roundIndex: group.roundIndex, userId: normalizedUserId }],
			skipDuplicates: true
		});

		if (created.count === 0) {
			throw new HttpError(CONFLICT, 'That cüz has already been taken');
		}

		groupName = group.name;
	});

	/*
	 * After the commit, and awaited — an unawaited rejection would escape the request as an
	 * unhandled one. The claim is already recorded by the time this runs, so
	 * `notifyGroupMembers` swallowing its own failures is what keeps a courtesy from failing
	 * the write.
	 */
	if (groupName !== null) {
		await notifyGroupMembers({
			actorUserId: normalizedUserId,
			build: ({ actorName, groupName: name }) => ({
				payload: { kind: 'POOL_BAB_CLAIMED', range: String(cuzNumber), takerName: actorName },
				push: language =>
					poolClaimPush(language, {
						groupName: name,
						kind: 'HATIM',
						range: String(cuzNumber),
						takerName: actorName
					})
			}),
			excludeUserIds: [normalizedUserId],
			groupId,
			pushKind: 'pool-claim',
			setting: settingFor('poolClaim', 'HATIM'),
			subject: String(cuzNumber)
		});
	}

	return { success: true };
};

/** Puts a borrowed cüz back in the havuz, along with any progress on it. */
export const releasePoolCuzForUser = async (
	userId: string,
	groupId: string,
	cuzNumber: number
): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });

		requireHatim(group);

		/*
		 * **Only a loan may be handed back, and only your own.** The cüz somebody joined with
		 * is not in the havuz and giving it up is leaving the group, not releasing a claim —
		 * so this is guarded on `isLoan` rather than on ownership alone.
		 */
		const released = await tx.cuzHolding.deleteMany({
			where: { cuzNumber, groupId, isLoan: true, roundIndex: group.roundIndex, userId: normalizedUserId }
		});

		if (released.count === 0) {
			throw new HttpError(BAD_REQUEST, 'That cüz is not yours to give back');
		}

		/*
		 * The read goes with the claim, and only the releaser's own. Someone else may have read
		 * this cüz in an earlier round and `BabRead` keeps that — what comes off is this round's
		 * read, by this person, of the cüz they are handing back.
		 */
		await tx.groupBab.updateMany({
			where: { groupId, number: cuzNumber, readByUserId: normalizedUserId },
			data: { readAt: null, readByUserId: null }
		});
		await tx.babRead.deleteMany({
			where: { babNumber: cuzNumber, groupId, roundIndex: group.roundIndex, userId: normalizedUserId }
		});

		// Releasing can un-complete the group, so the sync runs in the same transaction as the
		// write that changed the read state — never after it.
		await syncCompletedAt(tx, groupId);
	});

	return { success: true };
};
