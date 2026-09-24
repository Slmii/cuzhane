import { BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { normalizeInviteCode } from '@utils/inviteCode';
import { normalizeUserId } from '@utils/normalizeUserId';
import { CUZ_COUNT } from '@utils/units';
import type { Group, Prisma } from '../generated/prisma/client';
import { lockGroup, syncCompletedAt } from './babs.service';
import { autoStartIfFull } from './groups.service';
import { requireMembership, requireOwner } from './groupAccess.service';
import { getMemberProfiles } from '@utils/memberProfiles';
import { toGroupDetail, toGroupMember, toInvitePreview } from './groupSerializers';
import { poolBlockFor } from './pool.service';
import { holdingsFor, roundIndexFor } from './unitPlan';
import { recordNotification } from './notifications.service';
import { notifyGroupMembers } from './groupEvents.service';
import { memberJoinedPush, memberLeftPush } from '@utils/pushCopy';
import { sendPushToUser } from './push.service';
import { poolClaimReleasedPush, pushLanguageFor } from '@utils/pushCopy';
import type { GroupDetail, GroupInvitePreview, GroupMember } from './groupSerializers';
import { ensureCurrentRoundFor } from './rounds.service';

const loadDetail = async (groupId: string, viewerUserId: string): Promise<GroupDetail> => {
	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		include: {
			members: true,
			babs: true,
			cheers: true,
			// Only this viewer's, and only what they haven't acknowledged — the serializer
			// narrows further to the round in progress.
			poolReleases: { where: { userId: viewerUserId, seenAt: null } },
			roundSkips: { select: { roundIndex: true }, where: { userId: viewerUserId } }
		}
	});

	const profiles = await getMemberProfiles(group.members.map(member => member.userId));

	const holdings = await holdingsFor(prisma, group, group.roundIndex);

	return toGroupDetail(
		group,
		group.babs,
		group.members,
		group.cheers,
		viewerUserId,
		group.poolReleases,
		profiles,
		holdings,
		group.roundSkips.map(skip => skip.roundIndex)
	);
};

export const previewGroupByCode = async (userId: string, rawCode: string): Promise<GroupInvitePreview> => {
	const normalizedUserId = normalizeUserId(userId);
	const code = normalizeInviteCode(rawCode);

	const group = await prisma.group.findUnique({
		where: { inviteCode: code },
		include: { members: true, babs: true }
	});

	if (!group) {
		throw new HttpError(NOT_FOUND, 'Group not found');
	}

	// Without the holdings a hatim preview reports every cüz free — see `toInvitePreview`.
	const holdings = await holdingsFor(prisma, group, group.roundIndex);

	return toInvitePreview(group, group.babs, group.members, normalizedUserId, holdings);
};

export const previewGroupById = async (userId: string, groupId: string): Promise<GroupInvitePreview> => {
	const normalizedUserId = normalizeUserId(userId);

	const group = await prisma.group.findUnique({
		where: { id: groupId },
		include: { members: true, babs: true }
	});

	if (!group) {
		throw new HttpError(NOT_FOUND, 'Group not found');
	}

	const isMember = group.members.some(member => member.userId === normalizedUserId);

	if (group.visibility !== 'OPEN' && !isMember) {
		throw new HttpError(NOT_FOUND, 'Group not found');
	}

	// Without the holdings a hatim preview reports every cüz free — see `toInvitePreview`.
	const holdings = await holdingsFor(prisma, group, group.roundIndex);

	return toInvitePreview(group, group.babs, group.members, normalizedUserId, holdings);
};

const MAX_SLOT_ATTEMPTS = 5;

const isUniqueConstraintError = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';

/**
 * What a joiner has to bring, and what the group has to have left.
 *
 * **A hatim is joined by taking cüz, not by taking a seat.** Its `spots` is thirty because
 * `slotIndex` needs a ceiling, so the seat check below would let a thirty-first person in
 * only after twenty-nine others — while the group is *actually* full the moment the last
 * cüz is spoken for, which can happen with five members. And a member holding nothing is a
 * member who reads nothing: the board would list them with an empty share for ever.
 *
 * Every check runs inside the join's own transaction, against the holdings as they are at
 * that instant — two people reaching for cüz 7 together is settled by the unique key, and
 * the loser is told so rather than silently joining with one cüz fewer than they chose.
 */
const assertCuzSelectionIsValid = async (
	tx: Prisma.TransactionClient,
	group: Pick<Group, 'id' | 'kind' | 'maxPerMember' | 'roundIndex'>,
	cuzNumbers: number[] | undefined
): Promise<number[]> => {
	if (group.kind !== 'HATIM') {
		return [];
	}

	// Deduplicated before counting, or picking cüz 7 twice would spend two of a cap of three.
	const chosen = [...new Set(cuzNumbers ?? [])];

	if (chosen.length === 0) {
		throw new HttpError(BAD_REQUEST, 'Pick at least one cüz to join this hatim');
	}

	if (group.maxPerMember !== null && chosen.length > group.maxPerMember) {
		throw new HttpError(BAD_REQUEST, `This hatim allows at most ${group.maxPerMember} cüz per person`);
	}

	const held = await tx.cuzHolding.findMany({
		select: { cuzNumber: true },
		where: { groupId: group.id, roundIndex: group.roundIndex }
	});

	if (held.length >= CUZ_COUNT) {
		// The hatim's own kind of full: every cüz taken, whatever the seat count says.
		throw new HttpError(CONFLICT, 'This group is full');
	}

	const heldNumbers = new Set(held.map(holding => holding.cuzNumber));
	const clash = chosen.find(cuzNumber => heldNumbers.has(cuzNumber));

	if (clash !== undefined) {
		throw new HttpError(CONFLICT, `Cüz ${clash} has already been taken`);
	}

	return chosen;
};

/**
 * `viaInviteCode` distinguishes the two ways a join can start. Knowing a group id is not
 * authorisation to enter a PRIVATE group — that requires the invite code — but a correct
 * code IS the authorisation, so a code-based join may enter a private group.
 */
const attemptJoin = async (
	normalizedUserId: string,
	displayName: string,
	groupId: string,
	viaInviteCode: boolean,
	cuzNumbers?: number[]
): Promise<void> => {
	/*
	 * Whose claim the join released, and over which babs — collected inside the transaction
	 * but told to them outside it. A push is a courtesy; the join is the point, and Expo
	 * being slow or unreachable must never roll one back or hold the response open.
	 */
	let released: { userId: string; range: string } | null = null;

	await prisma.$transaction(async tx => {
		const group = await tx.group.findUnique({
			where: { id: groupId },
			include: { members: true }
		});

		if (!group) {
			throw new HttpError(NOT_FOUND, 'Group not found');
		}

		const alreadyMember = group.members.some(member => member.userId === normalizedUserId);

		if (alreadyMember) {
			throw new HttpError(CONFLICT, 'Already a member of this group');
		}

		if (!viaInviteCode && group.visibility === 'PRIVATE') {
			throw new HttpError(NOT_FOUND, 'Group not found');
		}

		if (!group.openToJoin) {
			throw new HttpError(FORBIDDEN, 'This group is not accepting members');
		}

		// Before a seat is taken: a hatim can be full while seats are free, and a joiner who
		// picked a cüz somebody else has just taken must be told, not quietly seated.
		const chosenCuz = await assertCuzSelectionIsValid(tx, group, cuzNumbers);

		const taken = new Set(group.members.map(member => member.slotIndex));
		let slotIndex: number | null = null;

		for (let slot = 0; slot < group.spots; slot++) {
			if (!taken.has(slot)) {
				slotIndex = slot;
				break;
			}
		}

		if (slotIndex === null) {
			throw new HttpError(CONFLICT, 'This group is full');
		}

		await tx.groupMember.create({
			data: {
				groupId,
				userId: normalizedUserId,
				displayName,
				role: 'MEMBER',
				slotIndex
			}
		});

		/*
		 * The cüz they came for, in the round the group is on.
		 *
		 * No `skipDuplicates`: the unique key on `(groupId, roundIndex, cuzNumber)` is the
		 * last word on two people reaching for the same cüz at once, and the loser has to
		 * fail the whole join rather than get a seat and a share one short of what they
		 * chose. The check above catches the ordinary case; this catches the same instant.
		 */
		if (chosenCuz.length > 0) {
			await tx.cuzHolding.createMany({
				data: chosenCuz.map(cuzNumber => ({
					cuzNumber,
					groupId,
					roundIndex: group.roundIndex,
					userId: normalizedUserId
				}))
			});
		}

		// Joining assigns no babs. Which block a member reads is derived from their seat and
		// the round, so writing their name onto a block here would only duplicate that — and
		// the duplicate goes stale the moment the rotation moves them off it.
		//
		// It does, however, *release* one. Volunteering out of the pool means "I'll cover for
		// an empty seat this round"; the seat now has someone in it, so the errand is over.
		// Left standing, the claim strands the volunteer: the block stops being pool (the seat
		// is taken) and was never their own seat's, so `setBabRead` refuses it as "not yours to
		// mark today" while their share still lists it. Meanwhile the joiner is handed the same
		// babs, because a share is derived from seat + round and knows nothing about claims.
		//
		// Reads already made are deliberately untouched: those happened, they belong to whoever
		// made them, and `BabRead` has them permanently. Only the claim on the rest comes off.
		//
		// `group.members` is the list from before the seat was filled, which is what makes this
		// seat a pool block at all. No `ensureCurrentRound` first: on a stale round this clears
		// babs the rollover is about to clear wholesale anyway, so the worst case is a no-op.
		const coveredBabNumbers = poolBlockFor(group, group.members, slotIndex);

		if (coveredBabNumbers) {
			// Read before the clear — afterwards there is nothing left to ask. A block is taken
			// whole by one person, so one row identifies them.
			const claim = await tx.groupBab.findFirst({
				where: { groupId, number: { in: coveredBabNumbers }, assignedUserId: { not: null } },
				select: { assignedUserId: true }
			});

			await tx.groupBab.updateMany({
				where: { groupId, number: { in: coveredBabNumbers }, assignedUserId: { not: null } },
				data: { assignedUserId: null }
			});

			const startBab = coveredBabNumbers[0];
			const endBab = coveredBabNumbers[coveredBabNumbers.length - 1];

			if (claim?.assignedUserId && startBab !== undefined && endBab !== undefined) {
				/*
				 * Written in the same transaction as the clear, so the record and the thing it
				 * describes can never disagree. The push that follows is the fast path; this is
				 * what the volunteer still finds if it never arrives.
				 */
				await tx.poolClaimRelease.create({
					data: { groupId, userId: claim.assignedUserId, roundIndex: group.roundIndex, startBab, endBab }
				});

				released = { userId: claim.assignedUserId, range: `${startBab}–${endBab}` };
			}
		}

		await tx.groupWaitlistEntry.deleteMany({
			where: { groupId, userId: normalizedUserId }
		});

		// Taking the last seat can open day 1, when the owner asked for that. Doing it here
		// rather than after the commit means the joiner's own response already says RUNNING.
		await autoStartIfFull(tx, groupId);
	});

	/*
	 * After the commit, and awaited rather than dangling: an unawaited promise here would
	 * escape the request and any rejection would surface as an unhandled one. `sendPushToUser`
	 * never throws, so awaiting it costs the join nothing and cannot fail it.
	 */
	if (released !== null) {
		const { userId: volunteerId, range } = released as { userId: string; range: string };
		const language = await pushLanguageFor(volunteerId);
		const [startBab, endBab] = range.split('–').map(Number);

		/*
		 * The inbox row is the durable half of this notice. `PoolClaimRelease` already records
		 * the same event for the group screen's banner; this is what puts it in the reader's
		 * own list (design P2), and it is filed whether or not the push reaches them.
		 */
		const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });

		if (group !== null && startBab !== undefined && endBab !== undefined) {
			await recordNotification({
				groupId,
				groupName: group.name,
				payload: { endBab, kind: 'POOL_CLAIM_RELEASED', startBab },
				userIds: [volunteerId]
			});
		}

		await sendPushToUser(volunteerId, {
			...poolClaimReleasedPush(language, range),
			data: { groupId, kind: 'pool-claim-released' }
		});
	}
};

const performJoin = async (
	userId: string,
	displayName: string,
	groupId: string,
	viaInviteCode: boolean,
	/** The cüz picked on QJ3. Ignored by a Cevşen group, required by a hatim. */
	cuzNumbers?: number[]
): Promise<GroupDetail> => {
	const normalizedUserId = normalizeUserId(userId);

	// Two people racing for the last seats both compute the same lowest free slot; the
	// `@@unique([groupId, slotIndex])` constraint rejects the loser. That's a lost race,
	// not a real conflict — re-read and take the next free seat instead of 500-ing.
	for (let attempt = 0; attempt < MAX_SLOT_ATTEMPTS; attempt++) {
		try {
			await attemptJoin(normalizedUserId, displayName, groupId, viaInviteCode, cuzNumbers);

			/*
			 * After the seat is taken, so the count in the message is the one that now includes
			 * them. Awaited rather than left dangling — `notifyGroupMembers` swallows its own
			 * failures, so this cannot turn a successful join into an error.
			 */
			await notifyGroupMembers({
				actorUserId: normalizedUserId,
				/*
				 * `actorName`, not the `displayName` this join was made with: that argument is
				 * whatever the session claims held, which for anyone who signed up before filling
				 * in their profile is "Member" — and the row said so.
				 */
				build: ({ actorName, groupName, memberCount, spots }) => ({
					payload: { kind: 'MEMBER_JOINED', memberCount, memberName: actorName, spots },
					push: language =>
						memberJoinedPush(language, { groupName, memberCount, memberName: actorName, spots })
				}),
				excludeUserIds: [normalizedUserId],
				groupId,
				pushKind: 'member-joined',
				setting: 'memberJoinedEnabled'
			});

			return loadDetail(groupId, normalizedUserId);
		} catch (error) {
			if (!isUniqueConstraintError(error) || attempt === MAX_SLOT_ATTEMPTS - 1) {
				throw error;
			}
		}
	}

	throw new HttpError(CONFLICT, 'Could not join this group, please try again');
};

export const joinGroupForUser = async (
	userId: string,
	displayName: string,
	groupId: string,
	cuzNumbers?: number[]
): Promise<GroupDetail> => performJoin(userId, displayName, groupId, false, cuzNumbers);

export const joinGroupByCodeForUser = async (
	userId: string,
	displayName: string,
	rawCode: string,
	cuzNumbers?: number[]
): Promise<GroupDetail> => {
	const code = normalizeInviteCode(rawCode);
	const group = await prisma.group.findUnique({
		where: { inviteCode: code },
		select: { id: true }
	});

	if (!group) {
		throw new HttpError(NOT_FOUND, 'Group not found');
	}

	return performJoin(userId, displayName, group.id, true, cuzNumbers);
};

// Unassigns the member's babs (clearing any progress they made on them) and removes their seat.
/**
 * `excludeUserIds` covers whoever already knows: the member leaving, and — when an owner removed
 * them — that owner too. From every other member's side the two cases are the same event, a seat
 * free again and its block back in the pool for the rest of the round.
 */
const removeMember = async (
	groupId: string,
	userId: string,
	notice: { displayName: string; excludeUserIds: string[] }
): Promise<void> => {
	await prisma.$transaction(async tx => {
		/*
		 * **The group lock before anything else**, the order every mutating path keeps. This
		 * took it last (inside `syncCompletedAt`), after deleting the member's holdings — so a
		 * round skip, which locks the group and then deletes the same holdings, could take the
		 * two in the opposite order and deadlock against it; and a round pick could slip in
		 * after this had swept the holdings, leaving cüz held by someone no longer in the group.
		 * Locked first, those paths either finish before this starts or find no member at all.
		 */
		await lockGroup(tx, groupId);

		// Delete the membership FIRST. Unassigning before deleting leaves a window in
		// which the member — still a member as far as a concurrent request is concerned —
		// claims another bab that the cleanup has already swept past, stranding it
		// assigned to a non-member. Dropping the seat first makes any such claim fail its
		// membership check instead.
		await tx.groupMember.delete({
			where: { groupId_userId: { groupId, userId } }
		});

		/*
		 * **A read stands after the reader leaves.** It used to be cleared — scoped to this
		 * member's own reads, which at least spared everyone else's work — and that was still
		 * wrong: the read *happened*. Undoing it takes a bab that was finished and puts it
		 * back on the board as outstanding, so the group is told to read something that has
		 * already been read, and a round that was complete silently isn't any more.
		 *
		 * `BabRead` was keeping the history through all of this, which is exactly why the
		 * damage was invisible: the record was right and the board disagreed with it.
		 */
		await tx.groupBab.updateMany({
			where: { groupId, assignedUserId: userId },
			data: { assignedUserId: null }
		});

		/*
		 * The **claim** does come off, and so do a hatim's holdings. Those say "I will read
		 * this", which a departed member will not — so the cüz go back to the pool for
		 * somebody else to take, in the round in progress and in any the group has already
		 * rolled into. Their reads in those rounds are untouched by this: a holding is a
		 * promise, a read is a fact.
		 */
		await tx.cuzHolding.deleteMany({ where: { groupId, userId } });

		// Nothing above can clear a read any more, so this can only ever *complete* a round —
		// the last bab of a departed member's claim being released does not un-read anything.
		// Kept because `completedAt` must never be decided anywhere but here.
		await syncCompletedAt(tx, groupId);
	});

	await notifyGroupMembers({
		// The seat is already deleted, so the group cannot supply the fallback name — this is the
		// one caller that has to hand it over.
		actorStoredName: notice.displayName,
		actorUserId: userId,
		build: ({ actorName, groupName, memberCount, spots }) => ({
			payload: { kind: 'MEMBER_LEFT', memberCount, memberName: actorName, spots },
			push: language => memberLeftPush(language, { groupName, memberCount, memberName: actorName, spots })
		}),
		excludeUserIds: notice.excludeUserIds,
		groupId,
		pushKind: 'member-left',
		setting: 'memberLeftEnabled'
	});
};

export const leaveGroupForUser = async (userId: string, groupId: string): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	const membership = await requireMembership(normalizedUserId, groupId);

	if (membership.role === 'OWNER') {
		throw new HttpError(BAD_REQUEST, 'The group owner cannot leave. Delete the group instead.');
	}

	await removeMember(groupId, normalizedUserId, {
		displayName: membership.displayName,
		excludeUserIds: [normalizedUserId]
	});

	return { success: true };
};

export const removeMemberForUser = async (
	userId: string,
	groupId: string,
	memberUserId: string
): Promise<{ success: true }> => {
	await requireOwner(userId, groupId);

	const normalizedMemberUserId = normalizeUserId(memberUserId);
	const membership = await requireMembership(normalizedMemberUserId, groupId);

	if (membership.role === 'OWNER') {
		throw new HttpError(BAD_REQUEST, 'The group owner cannot leave. Delete the group instead.');
	}

	await removeMember(groupId, normalizedMemberUserId, {
		displayName: membership.displayName,
		excludeUserIds: [normalizedMemberUserId, normalizeUserId(userId)]
	});

	return { success: true };
};

export const listMembersForUser = async (userId: string, groupId: string): Promise<GroupMember[]> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	// Roll the round first, as every other read path does — otherwise the first request after
	// a boundary lists the round that just closed, its reads and (for a hatim) its holdings.
	await ensureCurrentRoundFor(groupId);

	// The group itself is needed now: which block a member is reading depends on the plan
	// and the day, not just on the bab rows.
	const [group, members, babs, cheers] = await Promise.all([
		prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
		prisma.groupMember.findMany({ where: { groupId }, orderBy: { slotIndex: 'asc' } }),
		prisma.groupBab.findMany({ where: { groupId } }),
		prisma.cheer.findMany({ where: { groupId } })
	]);

	// Photos come from Clerk, not the database — the app never copies them. Cached briefly,
	// because this list polls every 30 seconds while anyone has it open.
	const [profiles, holdings] = await Promise.all([
		getMemberProfiles(members.map(member => member.userId)),
		// A hatim member's numbers are the cüz they hold this round — see `toGroupMember`.
		holdingsFor(prisma, group, roundIndexFor(group) ?? 0)
	]);

	return members.map(member => toGroupMember(group, member, babs, cheers, normalizedUserId, profiles, holdings));
};
