import { wrapperApi } from '@/api/wrapper.api';
import {
	CuzBoundaryPolicy,
	CuzDistribution,
	GroupCycle,
	GroupDetail,
	GroupSplitMode,
	GroupSummary,
	GroupVisibility,
	PoolCuz,
	PoolSlot
} from '@/lib/types/domain';

type CreateGroupCommon = {
	name: string;
	dedication?: string;
	visibility: GroupVisibility;
	/** Members see each other anonymously — the owner still sees names. */
	hideMemberNames?: boolean;
	/** Days without a read after which a member is released; null or absent for never. */
	inactivityDays?: number | null;
	reminderEnabled: boolean;
	reminderTime: string;
	autoStartWhenFull?: boolean;
	/**
	 * The creator's zone, which becomes the group's day for every member — a round boundary
	 * is a local midnight in it. Optional over the wire; the server defaults it.
	 */
	timezone?: string;
};

/**
 * Mirrors the server's `CreateGroupBodySchema`, union and all. A Cevşen group divides a
 * hundred babs by seat, a Hizb group 33 portions by seat (or by personal plan), and a hatim
 * divides thirty cüz by choice, so no kind's settings
 * mean anything to the other — and since all of them are immutable after creation, sending
 * one from the wrong half would be wrong for the life of the group.
 *
 * A hatim sends no `spots`: it is full when all thirty cüz are taken, not when thirty people
 * have joined, so the server pins the seat cap itself.
 */
export type CreateGroupInput =
	| (CreateGroupCommon & { kind: 'CEVSEN'; splitMode: GroupSplitMode; cycle: GroupCycle; spots: number })
	| (CreateGroupCommon & {
			kind: 'HIZB';
			splitMode: GroupSplitMode;
			cycle: GroupCycle;
			spots: number;
			/** Everyone reads the whole book on a personal plan rather than a seat's share. */
			hizbIndividual?: boolean;
			hizbStartPortion?: number;
			/** The personal plan's length in days — 7, 15 or 33. */
			hizbPlan?: number;
			/** "Okuma sorumluları" — the "has read" notice to the ticked members only. */
			readSeersEnabled?: boolean;
	  })
	| (CreateGroupCommon & {
			kind: 'HATIM';
			distribution: CuzDistribution;
			/** Null when QC2's optional cap is switched off — the default. */
			maxPerMember: number | null;
			boundaryPolicy: CuzBoundaryPolicy;
			roundDays: number;
			/** The cüz the creator takes (QC4). The server requires at least one. */
			cuzNumbers: number[];
	  });

// Mirrors the server's UpdateGroupBodySchema. `kind`, `spots`, `splitMode` and `cycle` are
// immutable once the group exists and are deliberately absent — the server rejects them.
export type UpdateGroupInput = {
	inactivityDays?: number | null;
	groupId: string;
	name?: string;
	dedication?: string | null;
	visibility?: GroupVisibility;
	hideMemberNames?: boolean;
	/** A shared Hizb plan's members who see who read — the whole choice, at most three. */
	readerSeerUserIds?: string[];
	/** "Okuma sorumluları" on or off; the ticks are kept either way. */
	readSeersEnabled?: boolean;
	openToJoin?: boolean;
	reminderEnabled?: boolean;
	reminderTime?: string;
	autoStartWhenFull?: boolean;
};

export type TakePoolSlotInput = {
	groupId: string;
	slotIndex: number;
};

/** One portion of a Hizb pool block, by its part number rather than its seat. */
export type TakePoolPartInput = {
	groupId: string;
	babNumber: number;
};

/** A hatim's havuz is addressed one cüz at a time — there are no slots to take whole. */
export type PoolCuzInput = {
	groupId: string;
	cuzNumber: number;
};

export type DiscoverGroupsParams = {
	search?: string;
	cycle?: GroupCycle;
};

export const getGroups = async () => wrapperApi<GroupSummary[]>('/groups', { method: 'GET' });

export const discoverGroups = async ({ search, cycle }: DiscoverGroupsParams) => {
	const params = new URLSearchParams();

	if (search) {
		params.set('search', search);
	}

	if (cycle) {
		params.set('cycle', cycle);
	}

	const query = params.toString();

	return wrapperApi<GroupSummary[]>(`/groups/discover${query ? `?${query}` : ''}`, { method: 'GET' });
};

export const getGroupById = async (groupId: string) => wrapperApi<GroupDetail>(`/groups/${groupId}`, { method: 'GET' });

export const createGroup = async (input: CreateGroupInput) =>
	wrapperApi<GroupDetail>('/groups', {
		method: 'POST',
		body: JSON.stringify(input)
	});

export const updateGroup = async ({ groupId, ...input }: UpdateGroupInput) =>
	wrapperApi<GroupDetail>(`/groups/${groupId}`, {
		method: 'PATCH',
		body: JSON.stringify(input)
	});

export const deleteGroup = async (groupId: string) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}`, { method: 'DELETE' });

export const regenerateInviteCode = async (groupId: string) =>
	wrapperApi<{ inviteCode: string }>(`/groups/${groupId}/invite-code`, { method: 'POST' });

export const startGroup = async (groupId: string) =>
	wrapperApi<GroupDetail>(`/groups/${groupId}/start`, { method: 'POST' });

export const getPoolSlots = async (groupId: string) =>
	wrapperApi<PoolSlot[]>(`/groups/${groupId}/pool`, { method: 'GET' });

export const takePoolSlot = async ({ groupId, slotIndex }: TakePoolSlotInput) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool/${slotIndex}`, { method: 'POST' });

export const releasePoolSlot = async ({ groupId, slotIndex }: TakePoolSlotInput) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool/${slotIndex}`, { method: 'DELETE' });

/**
 * One portion of a Hizb pool block, on top of the caller's share, for this round. Hizb groups
 * only — a Cevşen slot is taken whole, and the server answers 400 for one. 409 when somebody
 * already holds the portion.
 */
export const takePoolPart = async ({ groupId, babNumber }: TakePoolPartInput) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool/parts/${babNumber}`, { method: 'POST' });

/** Hands a portion the caller took back to the pool, with their read of it. */
export const releasePoolPart = async ({ groupId, babNumber }: TakePoolPartInput) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool/parts/${babNumber}`, { method: 'DELETE' });

export const getPoolCuz = async (groupId: string) =>
	wrapperApi<PoolCuz[]>(`/groups/${groupId}/pool-cuz`, { method: 'GET' });

export const takePoolCuz = async ({ cuzNumber, groupId }: PoolCuzInput) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool-cuz/${cuzNumber}`, { method: 'POST' });

export const releasePoolCuz = async ({ cuzNumber, groupId }: PoolCuzInput) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool-cuz/${cuzNumber}`, { method: 'DELETE' });

/** QR1's pick: the member's own cüz for the round in progress — not a havuz loan. */
export const pickRoundCuz = async ({ cuzNumbers, groupId }: { cuzNumbers: number[]; groupId: string }) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/round-cuz`, {
		method: 'POST',
		body: JSON.stringify({ cuzNumbers })
	});

/** QR1's "Bu turu atla": the member's cüz go back to the havuz and the round is sat out. */
export const skipRound = async (groupId: string) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/round-skip`, { method: 'POST' });

/** Acknowledges the "a joiner took over the block you volunteered for" notices in a group. */
export const markPoolReleasesSeen = async (groupId: string) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool-releases/seen`, { method: 'PATCH' });
