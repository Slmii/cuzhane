import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { formatInviteCode, generateInviteCode } from '@utils/inviteCode';
import { normalizeUserId } from '@utils/normalizeUserId';
import { ROUND_DAYS, roundEndsAt } from '@utils/rounds';
import { CUZ_COUNT, unitCountFor } from '@utils/units';
import type { CuzBoundaryPolicy, CuzDistribution } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { getMemberProfiles } from '@utils/memberProfiles';
import { requireMembership, requireOwner } from './groupAccess.service';
import { toGroupDetail, toGroupSummary } from './groupSerializers';
import { ensureCurrentRoundFor, ensureCurrentRoundsFor } from './rounds.service';
import { holdingsByGroupFor, holdingsFor } from './unitPlan';
import type { GroupCycle, GroupDetail, GroupSplitMode, GroupSummary, GroupVisibility } from './groupSerializers';

// `exactOptionalPropertyTypes` is on, so optional fields must admit `undefined`
// explicitly — Zod's inferred output types always include it on optional keys.
/** What both kinds are told. The halves that differ are the two branches below. */
type CreateGroupCommon = {
	name: string;
	dedication?: string | null | undefined;
	visibility: GroupVisibility;
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

/**
 * A union, mirroring `CreateGroupBodySchema` — see the note there on why the two kinds are
 * not one object with optional halves. Every one of these settings is immutable after
 * creation, so a field quietly ignored because it belonged to the other kind would be
 * wrong for the life of the group.
 */
export type CreateGroupInput =
	| (CreateGroupCommon & {
			kind: 'CEVSEN';
			splitMode: GroupSplitMode;
			/**
			 * **Only the two the body schema admits.** `GroupCycle` gained MONTHLY and CUSTOM for
			 * the hatim flow, and CUSTOM is not a preset at all — it means "the creator typed a
			 * number", which `ROUND_DAYS` cannot answer for. A Cevşen group never types one.
			 */
			cycle: Exclude<GroupCycle, 'MONTHLY' | 'CUSTOM'>;
			spots: number;
	  })
	| (CreateGroupCommon & {
			kind: 'HATIM';
			distribution: CuzDistribution;
			/** Null when QC2's optional cap is switched off, which is the default. */
			maxPerMember: number | null;
			boundaryPolicy: CuzBoundaryPolicy;
			/** The round's length in days, straight from QC3 — 7, 30, or whatever was typed. */
			roundDays: number;
			/** The cüz the creator takes (QC4). At least one — see the body schema. */
			cuzNumbers: number[];
	  });

/**
 * The columns that differ by kind, resolved once so the `create` below reads as one shape.
 *
 * **A hatim's `cycle` is derived from its length, not asked for.** The length is the real
 * setting (QC3 offers 1, 7, 30 or a number); the cadence is a label the shelf filters and
 * the round-reset copy still read, so the three presets keep their names and anything else
 * is CUSTOM. **And its `spots` is pinned at thirty**: a hatim is full when all thirty cüz are
 * taken rather than when thirty people have joined, so the seat cap is only the ceiling
 * `slotIndex` needs, never a divisor of anything. `splitMode` is inert for the same reason —
 * there are no blocks to rotate — so it records the value that never moves.
 */
const planColumnsFor = (input: CreateGroupInput) =>
	input.kind === 'HATIM'
		? {
				boundaryPolicy: input.boundaryPolicy,
				cycle: (input.roundDays === 1
					? 'DAILY'
					: input.roundDays === 7
					? 'WEEKLY'
					: input.roundDays === 30
					? 'MONTHLY'
					: 'CUSTOM') as GroupCycle,
				distribution: input.distribution,
				kind: 'HATIM' as const,
				maxPerMember: input.maxPerMember,
				roundDays: input.roundDays,
				splitMode: 'FIXED' as GroupSplitMode,
				spots: CUZ_COUNT
		  }
		: {
				boundaryPolicy: null,
				cycle: input.cycle as GroupCycle,
				distribution: null,
				kind: 'CEVSEN' as const,
				maxPerMember: null,
				roundDays: ROUND_DAYS[input.cycle],
				splitMode: input.splitMode,
				spots: input.spots
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

	// One query for the whole shelf, not one per group — and none at all when it holds no
	// hatim. See `holdingsByGroupFor`.
	const holdingsByGroupId = await holdingsByGroupFor(prisma, groups);
	// Which hatims the viewer is sitting out this round — what tells "must pick" from "skipped".
	const hatims = groups.filter(group => group.kind === 'HATIM');
	const skips =
		hatims.length === 0
			? []
			: await prisma.cuzRoundSkip.findMany({
					select: { groupId: true },
					where: {
						OR: hatims.map(group => ({ groupId: group.id, roundIndex: group.roundIndex })),
						userId: normalizedUserId
					}
			  });
	const skippedGroupIds = new Set(skips.map(skip => skip.groupId));

	return groups.map(group =>
		toGroupSummary(
			group,
			group.babs,
			group.members,
			normalizedUserId,
			holdingsByGroupId.get(group.id) ?? [],
			skippedGroupIds.has(group.id)
		)
	);
};

export const getGroupDetailForUser = async (userId: string, groupId: string): Promise<GroupDetail> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		include: {
			members: true,
			babs: true,
			cheers: true,
			// Only this viewer's, and only what they haven't acknowledged — the serializer
			// narrows further to the round in progress.
			poolReleases: { where: { userId: normalizedUserId, seenAt: null } },
			roundSkips: { select: { roundIndex: true }, where: { userId: normalizedUserId } }
		}
	});

	const profiles = await getMemberProfiles(group.members.map(member => member.userId));
	const holdings = await holdingsFor(prisma, group, group.roundIndex);

	return toGroupDetail(
		group,
		group.babs,
		group.members,
		group.cheers,
		normalizedUserId,
		group.poolReleases,
		profiles,
		holdings,
		group.roundSkips.map(skip => skip.roundIndex)
	);
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
	/*
	 * **The cadence is a label; the calendar wants a number.** A Cevşen cycle maps to a fixed
	 * length, so the preset answers for it — a hatim's round can be any number of days, which
	 * no enum carries, and that is why `roundDays` is stored rather than looked up.
	 */
	const plan = planColumnsFor(input);
	const endsAt = roundEndsAt(startsAt, plan.roundDays, input.timezone);

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
				...plan,
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
			// One row per unit — a hundred babs, or thirty cüz. See `unitCountFor`.
			data: Array.from({ length: unitCountFor(group) }, (_, index) => ({ groupId: group.id, number: index + 1 }))
		});

		/*
		 * **The creator's cüz, written in the same transaction as the group.**
		 *
		 * A hatim has no derivable share: `CuzHolding` rows *are* the answer to "what do you
		 * read", so a group created without them would exist with its owner holding nothing —
		 * the state the join flow refuses and the one `resolveUnitPlan` would report as an
		 * entirely free pool. Round 0 because that is the round a gathering group is on.
		 *
		 * De-duplicated: the picker cannot select a cüz twice, but the unique key would abort
		 * the whole transaction if a client ever sent one, and refusing to create a group over
		 * a repeated number is a worse answer than taking it once.
		 */
		if (input.kind === 'HATIM') {
			await tx.cuzHolding.createMany({
				data: [...new Set(input.cuzNumbers)].map(cuzNumber => ({
					cuzNumber,
					groupId: group.id,
					roundIndex: 0,
					userId: normalizedUserId
				}))
			});
		}

		await tx.groupMember.create({
			data: {
				groupId: group.id,
				userId: normalizedUserId,
				displayName,
				role: 'OWNER',
				slotIndex: 0
			}
		});

		// A hatim's owner can take all thirty on the way in — full before anyone else arrives,
		// so it starts now rather than waiting for a join that can never come.
		await autoStartIfFull(tx, group.id);

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
		select: { roundDays: true, timezone: true }
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
			endsAt: roundEndsAt(startedAt, group.roundDays, group.timezone)
		}
	});

	if (started.count === 0) {
		throw new HttpError(BAD_REQUEST, 'This hatim has already started');
	}

	return getGroupDetailForUser(userId, groupId);
};

/**
 * Starts a gathering group the moment it is full, when the owner asked for that. Called from
 * inside the join transaction (and the create one), so the member who filled it sees a running
 * group rather than a lobby that flips a second later.
 *
 * **Full is a different question per kind.** A Cevşen group is full when every seat is taken.
 * A hatim is full when all thirty cüz are held — its `spots` is thirty only because `slotIndex`
 * needs a ceiling, so counting members against it waited for thirty *people*, and a hatim of
 * five members holding every cüz never started. `CuzHolding` is unique per cüz per round, so its
 * count for the round is the number of distinct cüz taken.
 */
export const autoStartIfFull = async (tx: Prisma.TransactionClient, groupId: string): Promise<{ started: boolean }> => {
	const group = await tx.group.findUnique({
		where: { id: groupId },
		select: {
			spots: true,
			status: true,
			cycle: true,
			kind: true,
			roundDays: true,
			roundIndex: true,
			timezone: true,
			autoStartWhenFull: true,
			_count: { select: { members: true } }
		}
	});

	if (!group || group.status !== 'GATHERING' || !group.autoStartWhenFull) {
		return { started: false };
	}

	const isFull =
		group.kind === 'HATIM'
			? (await tx.cuzHolding.count({ where: { groupId, roundIndex: group.roundIndex } })) >= CUZ_COUNT
			: group._count.members >= group.spots;

	if (!isFull) {
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
			endsAt: roundEndsAt(startedAt, group.roundDays, group.timezone)
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

	// One query for the whole shelf, not one per group — and none at all when it holds no
	// hatim. See `holdingsByGroupFor`.
	const holdingsByGroupId = await holdingsByGroupFor(prisma, groups);

	return groups.map(group =>
		toGroupSummary(group, group.babs, group.members, normalizedUserId, holdingsByGroupId.get(group.id) ?? [])
	);
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
