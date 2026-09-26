import { wrapperApi } from '@/api/wrapper.api';
import { GroupDetail, GroupInvitePreview, GroupMember } from '@/lib/types/domain';

export type RemoveGroupMemberInput = {
	groupId: string;
	memberUserId: string;
};

type GroupInvitePreviewResponse = Omit<GroupInvitePreview, 'memberNames'> & { memberNames?: string[] | null };

// Some deployed APIs omit memberNames. Normalize before caching so every preview
// consumer can safely count/join the names without inventing identities.
const normalizePreview = (preview: GroupInvitePreviewResponse): GroupInvitePreview => ({
	...preview,
	memberNames: preview.memberNames ?? []
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

export const joinGroupByCode = async (code: string) =>
	wrapperApi<GroupDetail>('/memberships/join/code', {
		method: 'POST',
		body: JSON.stringify({ code })
	});

export const joinGroup = async (groupId: string) =>
	wrapperApi<GroupDetail>(`/memberships/join/${groupId}`, { method: 'POST' });

export const leaveGroup = async (groupId: string) =>
	wrapperApi<{ success: boolean }>(`/memberships/${groupId}/leave`, { method: 'DELETE' });

export const getGroupMembers = async (groupId: string) =>
	wrapperApi<GroupMember[]>(`/memberships/${groupId}/members`, { method: 'GET' });

export const removeGroupMember = async ({ groupId, memberUserId }: RemoveGroupMemberInput) =>
	wrapperApi<{ success: boolean }>(`/memberships/${groupId}/members/${memberUserId}`, { method: 'DELETE' });
