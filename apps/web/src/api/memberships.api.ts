import { wrapperApi } from '@/api/wrapper.api';
import { GroupDetail, GroupInvitePreview, GroupMember } from '@/lib/types/domain';

export type RemoveGroupMemberInput = {
	groupId: string;
	memberUserId: string;
};

type GroupInvitePreviewResponse = Omit<GroupInvitePreview, 'memberNames'> & { memberNames?: string[] | null };

// Some deployed APIs omit memberNames, and older ones sent names. A preview never shows who is
// in a group (it answers someone outside it), so the field is always normalised to the empty
// legacy list before caching — every consumer can still count/join it safely.
const normalizePreview = ({
	memberNames: _memberNames,
	...preview
}: GroupInvitePreviewResponse): GroupInvitePreview => ({
	...preview,
	memberNames: []
});

export const previewGroupByCode = async (code: string) =>
	normalizePreview(
		await wrapperApi<GroupInvitePreviewResponse>(`/memberships/preview/code/${encodeURIComponent(code)}`, {
			method: 'GET'
		})
	);

export const previewGroupById = async (groupId: string) =>
	normalizePreview(
		await wrapperApi<GroupInvitePreviewResponse>(`/memberships/preview/group/${groupId}`, { method: 'GET' })
	);

/** `cuzNumbers` as for `joinGroup` — a hatim is joined with the cüz it takes. */
export const joinGroupByCode = async (code: string, cuzNumbers?: number[]) =>
	wrapperApi<GroupDetail>('/memberships/join/code', {
		method: 'POST',
		body: JSON.stringify(cuzNumbers ? { code, cuzNumbers } : { code })
	});

/**
 * `cuzNumbers` is what a hatim is joined *with* — the server refuses one without it, since
 * you cannot be in a hatim and hold nothing. A Cevşen join sends no body at all, which is
 * also what every installed app sends, so the route treats it as optional on the wire and
 * requires it per kind in the service.
 */
export const joinGroup = async (groupId: string, cuzNumbers?: number[]) =>
	wrapperApi<GroupDetail>(`/memberships/join/${groupId}`, {
		method: 'POST',
		...(cuzNumbers ? { body: JSON.stringify({ cuzNumbers }) } : {})
	});

export const leaveGroup = async (groupId: string) =>
	wrapperApi<{ success: boolean }>(`/memberships/${groupId}/leave`, { method: 'DELETE' });

export const getGroupMembers = async (groupId: string) =>
	wrapperApi<GroupMember[]>(`/memberships/${groupId}/members`, { method: 'GET' });

export const removeGroupMember = async ({ groupId, memberUserId }: RemoveGroupMemberInput) =>
	wrapperApi<{ success: boolean }>(`/memberships/${groupId}/members/${memberUserId}`, { method: 'DELETE' });
