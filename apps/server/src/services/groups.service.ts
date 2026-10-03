import { enrollHizbInTransaction, hizbSummary, expireHizb } from './hizbReading.service';
import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { isPersonalPlan, PERSONAL_PLAN_MAX_DAYS, partCountFor } from '@utils/groupKinds';
import { formatInviteCode, generateInviteCode } from '@utils/inviteCode';
import { normalizeUserId } from '@utils/normalizeUserId';
import { civilDayNumber, ROUND_DAYS, roundEndsAt, roundLengthFor } from '@utils/rounds';
import { CUZ_COUNT, unitCountFor } from '@utils/units';
import type { CuzBoundaryPolicy, CuzDistribution } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { getMemberProfiles } from '@utils/memberProfiles';
import { requireMembership, requireOwner } from './groupAccess.service';
import { toGroupDetail, toGroupSummary } from './groupSerializers';
import { lockGroup, ensureCurrentRoundFor, ensureCurrentRoundsFor } from './rounds.service';
import { holdingsByGroupFor, holdingsFor } from './unitPlan';
import type { GroupCycle, GroupDetail, GroupSplitMode, GroupSummary, GroupVisibility } from './groupSerializers';

// `exactOptionalPropertyTypes` is on, so optional fields must admit `undefined`
// explicitly — Zod's inferred output types always include it on optional keys.
/** What every kind is told. The halves that differ are the branches below. */
type CreateGroupCommon = {
	name: string;
	dedication?: string | null | undefined;
	visibility: GroupVisibility;
	hideMemberNames?: boolean | undefined;
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
			 * the hatim and Hizb flows, and CUSTOM is not a preset at all — it means "the creator
			 * typed a number", which `ROUND_DAYS` cannot answer for. A Cevşen group never types one.
			 */
			cycle: Exclude<GroupCycle, 'MONTHLY' | 'CUSTOM'>;
			spots: number;
			/** A Şahsi reading's length in days; the seat settings above are then unused. */
			planDays?: number | undefined;
	  })
	| (CreateGroupCommon & {
			kind: 'HIZB';
			splitMode: GroupSplitMode;
			/** A Hizb MONTHLY is a calendar month — see `roundLengthFor`. */
			cycle: Exclude<GroupCycle, 'CUSTOM'>;
			spots: number;
			hizbIndividual?: boolean | undefined;
			hizbStartPortion?: number | undefined;
			/** A personal plan: 0 lets each member choose, otherwise 7/15/33 days. */
			hizbPlan?: number | undefined;
			inactivityDays?: number | null | undefined;
			/** "Okuma sorumluları" — a shared plan's "has read" notice to the ticked members only. */
			readSeersEnabled?: boolean | undefined;
	  })
	| (CreateGroupCommon & {
			kind: 'HATIM';
			distribution: CuzDistribution;
			/** Null when QC2's optional cap is switched off, which is the default. */
			maxPerMember: number | null;
			boundaryPolicy: CuzBoundaryPolicy;
			/** The round's length in days, straight from QC3 — 7, 30, or whatever was typed. */
			roundDays: number;
			/** The cüz the creator takes (QC4). At least one unless Şahsi — see the body schema. */
			cuzNumbers?: number[] | undefined;
			/** A Şahsi reading's length in days; the sharing settings above are then unused. */
			planDays?: number | undefined;
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
 *
 * A seat-based kind (Cevşen, Hizb) takes its length from the cadence preset. A personal Hizb
 * plan runs by the day and has no seats, and neither has a flexible group, so both are sized
 * to the whole book. A Hizb MONTHLY stores thirty days too, though the calendar reads it as a
 * calendar month (`roundLengthFor`). A Şahsi Cevşen or Kur'an reading is shaped as a personal Hizb
 * plan is, with none of the hatim's sharing rules.
 */
const planColumnsFor = (input: CreateGroupInput, { flexible, personal }: { flexible: boolean; personal: boolean }) => {
	if (input.kind !== 'HIZB' && input.planDays !== undefined) {
		return {
			boundaryPolicy: null,
			cycle: 'DAILY' as GroupCycle,
			distribution: null,
			kind: input.kind,
			maxPerMember: null,
			roundDays: ROUND_DAYS.DAILY,
			splitMode: 'FLEXIBLE' as GroupSplitMode,
			spots: partCountFor(input.kind)
		};
	}

	if (input.kind === 'HATIM') {
		return {
			boundaryPolicy: input.boundaryPolicy,
			cycle: (input.roundDays === 1
				? 'DAILY'
				: input.roundDays === 7
				? 'WEEKLY'
				: input.roundDays === 30
				? 'MONTHLY'
				: 'CUSTOM') as GroupCycle,
			distribution: input.distribution,
			kind: input.kind,
			maxPerMember: input.maxPerMember,
			roundDays: input.roundDays,
			splitMode: 'FIXED' as GroupSplitMode,
			spots: CUZ_COUNT
		};
	}

	const cycle = personal ? 'DAILY' : input.cycle;

	return {
		boundaryPolicy: null,
		cycle: cycle as GroupCycle,
		distribution: null,
		kind: input.kind,
		maxPerMember: null,
		roundDays: ROUND_DAYS[cycle],
		splitMode: (personal ? 'FLEXIBLE' : input.splitMode) as GroupSplitMode,
		spots: flexible ? partCountFor(input.kind) : input.spots
	};
};

export type UpdateGroupInput = {
	inactivityDays?: number | null | undefined;
	name?: string | undefined;
	dedication?: string | null | undefined;
	visibility?: GroupVisibility | undefined;
	hideMemberNames?: boolean | undefined;
	/** A shared Hizb plan's members who see who read (the owner may be one of them), at most three. */
	readerSeerUserIds?: string[] | undefined;
	/** "Okuma sorumluları" on or off; the ticks are kept either way. */
	readSeersEnabled?: boolean | undefined;
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
/** How many members of a shared Hizb plan may see who read. Mirrored in the web app's Yönet. */
export const MAX_READER_SEERS = 3;
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

	return Promise.all(
		groups.map(async group => ({
			...toGroupSummary(
				group,
				group.babs,
				group.members,
				normalizedUserId,
				holdingsByGroupId.get(group.id) ?? [],
				skippedGroupIds.has(group.id)
			),
			// A personal Hizb plan's share is the member's own assignment, not a seat's block.
			...(isPersonalPlan(group) ? await hizbSummary(group.id, normalizedUserId) : {})
		}))
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

	const detail = toGroupDetail(
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
	return isPersonalPlan(group) ? { ...detail, ...(await hizbSummary(group.id, normalizedUserId)) } : detail;
};

export const createGroupForUser = async (
	userId: string,
	displayName: string,
	input: CreateGroupInput
): Promise<GroupDetail> => {
	const normalizedUserId = normalizeUserId(userId);
	const startsAt = new Date();
	// The Hizb's plan settings, or none for the other kinds (the body schema refuses them there).
	const hizb = input.kind === 'HIZB' ? input : null;
	// A Şahsi Cevşen or Kur'an reading: one person's plan, always from the first part.
	const planDays = input.kind === 'HIZB' ? null : input.planDays ?? null;
	const personal = hizb?.hizbPlan !== undefined || planDays !== null;
	const individual = (hizb?.hizbIndividual ?? false) || planDays !== null;
	const startPortion = hizb?.hizbStartPortion ?? 1;
	if (
		!Number.isInteger(startPortion) ||
		startPortion < 1 ||
		(hizb && individual ? !personal || !hizb.hizbPlan || startPortion > hizb.hizbPlan : startPortion !== 1)
	) {
		throw new HttpError(BAD_REQUEST, 'Invalid individual reading start');
	}
	if (hizb?.hizbPlan !== undefined && ![0, 7, 15, 33].includes(hizb.hizbPlan)) {
		throw new HttpError(BAD_REQUEST, 'Invalid personal plan');
	}
	if (
		planDays !== null &&
		(input.kind === 'HIZB' ||
			!Number.isInteger(planDays) ||
			planDays < 1 ||
			planDays > PERSONAL_PLAN_MAX_DAYS[input.kind])
	) {
		throw new HttpError(BAD_REQUEST, 'Invalid personal plan');
	}
	const flexible = personal || (input.kind !== 'HATIM' && input.splitMode === 'FLEXIBLE');
	if (flexible && !personal && input.visibility !== 'OPEN') {
		throw new HttpError(BAD_REQUEST, 'Flexible groups must be open');
	}
	/*
	 * **The cadence is a label; the calendar wants a number.** A Cevşen cycle maps to a fixed
	 * length, so the preset answers for it — a hatim's round can be any number of days, which
	 * no enum carries, and that is why `roundDays` is stored rather than looked up. A Hizb
	 * MONTHLY is the one calendar month, which `roundLengthFor` answers for.
	 */
	const plan = planColumnsFor(input, { flexible, personal });
	// A placeholder until the owner starts: `startGroupForUser` recomputes it from the
	// moment round 0 actually begins, so gathering time doesn't eat into the round.
	const endsAt = roundEndsAt(startsAt, roundLengthFor(plan), 0, input.timezone);

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
				visibility: individual ? 'PRIVATE' : input.visibility,
				hideMemberNames: input.hideMemberNames ?? false,
				...plan,
				hizbPlan: hizb?.hizbPlan ?? null,
				hizbIndividual: individual,
				planDays,
				hizbStartPortion: startPortion,
				openToJoin: !individual,
				inactivityDays: personal && !individual ? hizb?.inactivityDays ?? null : null,
				readSeersEnabled: personal && !individual ? hizb?.readSeersEnabled ?? false : false,
				// The owner's zone becomes the group's day. Everyone's board resets on this
				// clock, which is why it is captured once and never changed.
				timezone: input.timezone,
				inviteCode,
				reminderEnabled: input.reminderEnabled,
				reminderTime: input.reminderTime,
				autoStartWhenFull: flexible ? false : input.autoStartWhenFull ?? true,
				// A new group gathers members first — the owner starts day 1 explicitly, so
				// nothing is counted while people are still joining.
				status: flexible ? 'RUNNING' : 'GATHERING',
				startedAt: flexible ? startsAt : null,
				roundStartedAt: flexible ? startsAt : null,
				startsAt,
				endsAt
			}
		});

		// One row per unit — a hundred babs, thirty cüz or 33 Hizb portions (`unitCountFor`) —
		// with nothing but its number. Ownership isn't stored: who reads which block falls out
		// of the seat and the round (or, for a hatim, `CuzHolding`), and `assignedUserId` is
		// reserved for pool volunteering. A personal plan has no shared board.
		if (!personal) {
			await tx.groupBab.createMany({
				data: Array.from({ length: unitCountFor(group) }, (_, index) => ({
					groupId: group.id,
					number: index + 1
				}))
			});
		}

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
		 * a repeated number is a worse answer than taking it once. A Şahsi reading holds none: its
		 * plan reads every cüz in turn.
		 */
		if (input.kind === 'HATIM' && !personal) {
			await tx.cuzHolding.createMany({
				data: [...new Set(input.cuzNumbers ?? [])].map(cuzNumber => ({
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
				slotIndex: 0,
				// A shared Hizb plan's owner sees who read unless they untick themselves.
				seesReaders: personal && !individual
			}
		});

		if (personal && group.hizbPlan !== 0) {
			await enrollHizbInTransaction(tx, group, normalizedUserId);
		}

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
	const existing = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
	if (
		existing.hizbIndividual &&
		(input.visibility === 'OPEN' || input.openToJoin === true || input.inactivityDays != null)
	) {
		throw new HttpError(BAD_REQUEST, 'Individual reading stays private with no inactivity removal');
	}
	if (
		!isPersonalPlan(existing) &&
		existing.splitMode === 'FLEXIBLE' &&
		(input.visibility === 'PRIVATE' || input.openToJoin === false || input.autoStartWhenFull === true)
	) {
		throw new HttpError(BAD_REQUEST, 'Flexible groups stay open to everyone');
	}

	if (input.spots !== undefined || input.splitMode !== undefined || input.cycle !== undefined) {
		throw new HttpError(BAD_REQUEST, 'Spots, split mode, and cycle cannot be changed after creation');
	}

	const seers = input.readerSeerUserIds?.map(normalizeUserId);
	if (
		(seers !== undefined || input.readSeersEnabled !== undefined) &&
		(existing.hizbPlan === null || existing.hizbIndividual)
	) {
		throw new HttpError(BAD_REQUEST, 'Only a shared Hizb plan has readers to watch');
	}
	if (seers !== undefined) {
		if (new Set(seers).size !== seers.length || seers.length > MAX_READER_SEERS) {
			throw new HttpError(BAD_REQUEST, `Choose at most ${MAX_READER_SEERS} members`);
		}
		const found = await prisma.groupMember.count({ where: { groupId, userId: { in: seers } } });
		if (found !== seers.length) {
			throw new HttpError(BAD_REQUEST, 'Only members of this group can be chosen');
		}
	}

	const data: Prisma.GroupUpdateInput = {};
	if (input.readSeersEnabled !== undefined) {
		data.readSeersEnabled = input.readSeersEnabled;
	}
	if (input.inactivityDays !== undefined) {
		if (existing.hizbPlan === null) {
			throw new HttpError(BAD_REQUEST, 'Inactivity applies to personal Hizb plans');
		}
		data.inactivityDays = input.inactivityDays;
		data.inactivitySinceDay = civilDayNumber(new Date(), existing.timezone);
	}

	if (input.name !== undefined) {
		data.name = input.name;
	}

	if (input.dedication !== undefined) {
		data.dedication = input.dedication;
	}

	if (input.visibility !== undefined) {
		data.visibility = input.visibility;
	}
	if (input.hideMemberNames !== undefined) {
		data.hideMemberNames = input.hideMemberNames;
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

	await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const previous = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
		if (previous.hizbPlan !== null) {
			await expireHizb(tx, previous);
		}
		await tx.group.update({ where: { id: groupId }, data });
		if (seers !== undefined) {
			await tx.groupMember.updateMany({ where: { groupId }, data: { seesReaders: false } });
			await tx.groupMember.updateMany({ where: { groupId, userId: { in: seers } }, data: { seesReaders: true } });
		}
		if (input.hideMemberNames === true) {
			const current = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
			// Responsible members may still see who read: their own "has read" rows keep the name,
			// marked so it stays theirs alone (listing hides it once they are no longer ticked, and for
			// good once the group is deleted).
			if (current.readSeersEnabled) {
				await tx.$executeRaw`UPDATE "Notification"
					SET "payload" = "payload"::jsonb || '{"seersOnly":true}'::jsonb
					WHERE "groupId" = ${groupId} AND "kind" = 'SHARE_READ'
					AND "userId" IN (
						SELECT "userId" FROM "GroupMember" WHERE "groupId" = ${groupId} AND "seesReaders"
					)`;
			}
			// Older inbox rows outlive the group. Remove their names permanently as well.
			await tx.$executeRaw`UPDATE "Notification"
				SET "payload" = ("payload"::jsonb - 'readerName' - 'takerName' - 'memberName') || '{"anonymous":true}'::jsonb
				WHERE "groupId" = ${groupId} AND NOT ("payload"::jsonb ? 'seersOnly')`;
		}
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
		select: { cycle: true, kind: true, roundDays: true, timezone: true }
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
			endsAt: roundEndsAt(startedAt, roundLengthFor(group), 0, group.timezone)
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
			endsAt: roundEndsAt(startedAt, roundLengthFor(group), 0, group.timezone)
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
			{ visibility: 'OPEN', hizbIndividual: false },
			{ openToJoin: true },
			// Nor does a group you are already in. Discover exists to find groups to join,
			// and yours are one tab away in Gruplarım — listing them here offers a "Katıl"
			// you cannot take and buries the ones you actually could.
			{ id: { notIn: joinedGroupIds } },
			// A Hizb group without a plan — the seat board or the flexible one — never appears:
			// Discover shows only the personal-plan model (design decision 11). Its existing
			// members keep their group screen.
			{ NOT: { kind: 'HIZB', hizbPlan: null } },
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

	return Promise.all(
		groups.map(async group => ({
			...toGroupSummary(
				group,
				group.babs,
				group.members,
				normalizedUserId,
				holdingsByGroupId.get(group.id) ?? []
			),
			...(isPersonalPlan(group) ? await hizbSummary(group.id, normalizedUserId) : {})
		}))
	);
};

export const regenerateInviteCodeForUser = async (userId: string, groupId: string): Promise<{ inviteCode: string }> => {
	await requireOwner(userId, groupId);
	const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
	if (group.hizbIndividual) {
		throw new HttpError(BAD_REQUEST, 'Individual reading has no invitations');
	}

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
