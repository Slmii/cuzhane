import { wrapperApi } from '@/api/wrapper.api';
import { GroupDetail, GroupInvitePreview, GroupMember } from '@/lib/types/domain';

export type RemoveGroupMemberInput = {
	groupId: string;
	memberUserId: string;
};

export const previewGroupByCode = async (code: string) =>
	wrapperApi<GroupInvitePreview>(`/memberships/preview/code/${encodeURIComponent(code)}`, { method: 'GET' });

export const previewGroupById = async (groupId: string) =>
	wrapperApi<GroupInvitePreview>(`/memberships/preview/group/${groupId}`, { method: 'GET' });

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
