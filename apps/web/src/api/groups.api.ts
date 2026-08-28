import { wrapperApi } from '@/api/wrapper.api';
import { GroupCycle, GroupDetail, GroupSplitMode, GroupSummary, GroupVisibility, PoolSlot } from '@/lib/types/domain';

export type CreateGroupInput = {
	name: string;
	dedication?: string;
	visibility: GroupVisibility;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	spots: number;
	reminderEnabled: boolean;
	reminderTime: string;
	autoStartWhenFull?: boolean;
	/**
	 * The creator's zone, which becomes the group's day for every member — a round boundary
	 * is a local midnight in it. Optional over the wire; the server defaults it.
	 */
	timezone?: string;
};

// Mirrors the server's UpdateGroupBodySchema. `spots`, `splitMode` and `cycle` are
// immutable once the group exists and are deliberately absent — the server rejects them.
export type UpdateGroupInput = {
	groupId: string;
	name?: string;
	dedication?: string | null;
	visibility?: GroupVisibility;
	openToJoin?: boolean;
	reminderEnabled?: boolean;
	reminderTime?: string;
	autoStartWhenFull?: boolean;
};

export type TakePoolSlotInput = {
	groupId: string;
	slotIndex: number;
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

/** Acknowledges the "a joiner took over the block you volunteered for" notices in a group. */
export const markPoolReleasesSeen = async (groupId: string) =>
	wrapperApi<{ success: boolean }>(`/groups/${groupId}/pool-releases/seen`, { method: 'PATCH' });
