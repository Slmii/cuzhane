import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { BAB_COUNT } from '@utils/babs';
import { formatInviteCode, generateInviteCode } from '@utils/inviteCode';
import { normalizeUserId } from '@utils/normalizeUserId';
import { roundEndsAt } from '@utils/rounds';
import type { Prisma } from '../generated/prisma/client';
import { requireMembership, requireOwner } from './groupAccess.service';
import { toGroupDetail, toGroupSummary } from './groupSerializers';
import { ensureCurrentRoundFor, ensureCurrentRoundsFor } from './rounds.service';
import type { GroupCycle, GroupDetail, GroupSplitMode, GroupSummary, GroupVisibility } from './groupSerializers';

// `exactOptionalPropertyTypes` is on, so optional fields must admit `undefined`
// explicitly — Zod's inferred output types always include it on optional keys.
export type CreateGroupInput = {
	name: string;
	dedication?: string | null | undefined;
	visibility: GroupVisibility;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	spots: number;
	reminderEnabled: boolean;
	reminderTime: string;
	autoStartWhenFull?: boolean | undefined;
	/**
	 * IANA zone the group's rounds are measured in — the creator's. Not optional here even
	 * though it is over the wire: the Zod schema defaults it, so by the time a request
	 * reaches this layer there is always a zone.
	 */
	timezone: string;
};

export type UpdateGroupInput = {
	name?: string | undefined;
	dedication?: string | null | undefined;
	visibility?: GroupVisibility | undefined;
	openToJoin?: boolean | undefined;
	reminderEnabled?: boolean | undefined;
	reminderTime?: string | undefined;
	autoStartWhenFull?: boolean | undefined;
	// Immutable after creation — present here only so we can detect and reject an attempt.
	spots?: number | undefined;
	splitMode?: GroupSplitMode | undefined;
	cycle?: GroupCycle | undefined;
};

export type DiscoverGroupsQuery = {
	search?: string | undefined;
	cycle?: GroupCycle | undefined;
};

const DISCOVER_LIMIT = 50;
const MAX_INVITE_CODE_ATTEMPTS = 5;

const isUniqueConstraintError = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';

/**
 * Picks an invite code that is currently unused. The check is deliberately done
 * outside any transaction: a unique violation aborts the surrounding Postgres
 * transaction outright, so a code collision must be resolved before we open one.
 * The keyspace is 32^8 (~1.1e12), so a second collision after this check is not a
 * practical concern — and the unique index still backstops it.
 */
const reserveInviteCode = async (): Promise<string> => {
	for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
		const candidate = generateInviteCode();
		const existing = await prisma.group.findUnique({ where: { inviteCode: candidate }, select: { id: true } });

		if (!existing) {
			return candidate;
		}
	}

	throw new HttpError(INTERNAL_SERVER_ERROR, 'Could not allocate an invite code');
};

export const listGroupsForUser = async (userId: string): Promise<GroupSummary[]> => {
	const normalizedUserId = normalizeUserId(userId);

	const memberships = await prisma.groupMember.findMany({
		where: { userId: normalizedUserId },
		select: { groupId: true }
	});

	const groupIds = memberships.map(membership => membership.groupId);

	if (groupIds.length === 0) {
		return [];
	}

	// Before reading anything: a group whose cycle boundary has passed rolls to its new
	// round here, so the list never shows yesterday's board.
	await ensureCurrentRoundsFor(groupIds);

	const groups = await prisma.group.findMany({
		where: { id: { in: groupIds } },
		orderBy: { createdAt: 'desc' },
		include: { members: true, babs: true }
	});

	return groups.map(group => toGroupSummary(group, group.babs, group.members, normalizedUserId));
};

export const getGroupDetailForUser = async (userId: string, groupId: string): Promise<GroupDetail> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		include: { members: true, babs: true, cheers: true }
	});

	return toGroupDetail(group, group.babs, group.members, group.cheers, normalizedUserId);
};

export const createGroupForUser = async (
	userId: string,
	displayName: string,
	input: CreateGroupInput
): Promise<GroupDetail> => {
	const normalizedUserId = normalizeUserId(userId);
	const startsAt = new Date();
	// A placeholder until the owner starts: `startGroupForUser` recomputes it from the
	// moment round 0 actually begins, so gathering time doesn't eat into the round.
	const endsAt = roundEndsAt(startsAt, input.cycle, input.timezone);

	// Resolve the invite code BEFORE opening the transaction. Postgres aborts the whole
	// transaction on a unique violation, so retrying `create` inside one can never
	// recover — every attempt after the first fails with "transaction is aborted".
	const inviteCode = await reserveInviteCode();

	const groupId = await prisma.$transaction(async tx => {
		const group = await tx.group.create({
			data: {
				ownerUserId: normalizedUserId,
				name: input.name,
				dedication: input.dedication ?? null,
				visibility: input.visibility,
				splitMode: input.splitMode,
				cycle: input.cycle,
				spots: input.spots,
				// The owner's zone becomes the group's day. Everyone's board resets on this
				// clock, which is why it is captured once and never changed.
				timezone: input.timezone,
				inviteCode,
				reminderEnabled: input.reminderEnabled,
				reminderTime: input.reminderTime,
				autoStartWhenFull: input.autoStartWhenFull ?? true,
				// A new group gathers members first — the owner starts day 1 explicitly, so
				// nothing is counted while people are still joining.
				status: 'GATHERING',
				startedAt: null,
				startsAt,
				endsAt
			}
		});

		// A hundred rows with nothing but their number. Ownership isn't stored: who reads
		// which block falls out of the seat and the round, and `assignedUserId` is reserved
		// for pool volunteering.
		await tx.groupBab.createMany({
			data: Array.from({ length: BAB_COUNT }, (_, index) => ({ groupId: group.id, number: index + 1 }))
		});

		await tx.groupMember.create({
			data: {
				groupId: group.id,
				userId: normalizedUserId,
				displayName,
				role: 'OWNER',
				slotIndex: 0
			}
		});

		return group.id;
	});

	return getGroupDetailForUser(userId, groupId);
};

export const updateGroupForUser = async (
	userId: string,
	groupId: string,
	input: UpdateGroupInput
): Promise<GroupDetail> => {
	await requireOwner(userId, groupId);

	if (input.spots !== undefined || input.splitMode !== undefined || input.cycle !== undefined) {
		throw new HttpError(BAD_REQUEST, 'Spots, split mode, and cycle cannot be changed after creation');
	}

	const data: Prisma.GroupUpdateInput = {};

	if (input.name !== undefined) {
		data.name = input.name;
	}

	if (input.dedication !== undefined) {
		data.dedication = input.dedication;
	}

	if (input.visibility !== undefined) {
		data.visibility = input.visibility;
	}

	if (input.openToJoin !== undefined) {
		data.openToJoin = input.openToJoin;
	}

	if (input.reminderEnabled !== undefined) {
		data.reminderEnabled = input.reminderEnabled;
	}

	if (input.reminderTime !== undefined) {
		data.reminderTime = input.reminderTime;
	}

	if (input.autoStartWhenFull !== undefined) {
		data.autoStartWhenFull = input.autoStartWhenFull;
	}

	await prisma.group.update({
		where: { id: groupId },
		data
	});

	return getGroupDetailForUser(userId, groupId);
};

/**
 * Opens day 1. Only the owner can, and only once — `status` is the guard, so a double
 * tap can't reset `startedAt` and rewind everyone's rotation to the start.
 *
 * Whatever seats are still empty stay empty: their babs become the shared pool. That is
 * the whole point of gathering first — the group commits to a roster, then starts.
 */
export const startGroupForUser = async (userId: string, groupId: string): Promise<GroupDetail> => {
	await requireOwner(userId, groupId);

	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		select: { cycle: true, timezone: true }
	});
	const startedAt = new Date();

	// The cycle measures the running round, not the gathering. `endsAt` was derived at
	// creation as a placeholder; a group that spent three days filling up would otherwise
	// start with three of its days already spent — a DAILY one already expired.
	const started = await prisma.group.updateMany({
		where: { id: groupId, status: 'GATHERING' },
		data: {
			status: 'RUNNING',
			startedAt,
			// Round 0 begins with the hatim. Without this the rollover would see a null start
			// and treat the very first round as overdue.
			roundIndex: 0,
			roundStartedAt: startedAt,
			endsAt: roundEndsAt(startedAt, group.cycle, group.timezone)
		}
	});

	if (started.count === 0) {
		throw new HttpError(BAD_REQUEST, 'This hatim has already started');
	}

	return getGroupDetailForUser(userId, groupId);
};

/**
 * Starts a gathering group the moment its last seat is taken, when the owner asked for
 * that. Called from inside the join transaction, so the new member sees a running group
 * rather than a lobby that flips a second later.
 */
export const autoStartIfFull = async (tx: Prisma.TransactionClient, groupId: string): Promise<{ started: boolean }> => {
	const group = await tx.group.findUnique({
		where: { id: groupId },
		select: {
			spots: true,
			status: true,
			cycle: true,
			timezone: true,
			autoStartWhenFull: true,
			_count: { select: { members: true } }
		}
	});

	if (!group || group.status !== 'GATHERING' || !group.autoStartWhenFull || group._count.members < group.spots) {
		return { started: false };
	}

	// Conditional, like the manual start: the read above and this write are not atomic, so
	// an owner tapping "start" in between would otherwise have their `startedAt` overwritten
	// — which would shift the rotation anchor for everyone.
	const startedAt = new Date();
	const started = await tx.group.updateMany({
		where: { id: groupId, status: 'GATHERING' },
		data: {
			status: 'RUNNING',
			startedAt,
			roundIndex: 0,
			roundStartedAt: startedAt,
			endsAt: roundEndsAt(startedAt, group.cycle, group.timezone)
		}
	});

	return { started: started.count > 0 };
};

export const deleteGroupForUser = async (userId: string, groupId: string): Promise<{ success: true }> => {
	await requireOwner(userId, groupId);

	await prisma.group.delete({ where: { id: groupId } });

	return { success: true };
};

export const discoverGroups = async (userId: string, query: DiscoverGroupsQuery): Promise<GroupSummary[]> => {
	const normalizedUserId = normalizeUserId(userId);

	const memberships = await prisma.groupMember.findMany({
		where: { userId: normalizedUserId },
		select: { groupId: true }
	});

	const joinedGroupIds = memberships.map(membership => membership.groupId);

	const filters: Prisma.GroupWhereInput[] = [];

	if (query.cycle) {
		filters.push({ cycle: query.cycle });
	}

	if (query.search) {
		filters.push({ name: { contains: query.search, mode: 'insensitive' } });
	}

	const where: Prisma.GroupWhereInput = {
		AND: [
			// Discover is the *public* shelf: a PRIVATE group never appears here, not even
			// to its own owner — it is reachable from "my groups" and by invite only.
			{ visibility: 'OPEN' },
			{ openToJoin: true },
			// Nor does a group you are already in. Discover exists to find groups to join,
			// and yours are one tab away in Gruplarım — listing them here offers a "Katıl"
			// you cannot take and buries the ones you actually could.
			{ id: { notIn: joinedGroupIds } },
			...filters
		]
	};

	// Two passes: roll any overdue group forward, then read. Discover shows other people's
	// progress, and a stale round would advertise last round's percentage.
	const stale = await prisma.group.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		take: DISCOVER_LIMIT,
		select: { id: true }
	});

	await ensureCurrentRoundsFor(stale.map(group => group.id));

	const groups = await prisma.group.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		take: DISCOVER_LIMIT,
		include: { members: true, babs: true }
	});

	return groups.map(group => toGroupSummary(group, group.babs, group.members, normalizedUserId));
};

export const regenerateInviteCodeForUser = async (userId: string, groupId: string): Promise<{ inviteCode: string }> => {
	await requireOwner(userId, groupId);

	for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
		try {
			const updated = await prisma.group.update({
				where: { id: groupId },
				data: { inviteCode: generateInviteCode() }
			});

			return { inviteCode: formatInviteCode(updated.inviteCode) };
		} catch (error) {
			if (!isUniqueConstraintError(error) || attempt === MAX_INVITE_CODE_ATTEMPTS - 1) {
				throw error;
			}
		}
	}

	throw new Error('Failed to regenerate invite code');
};
