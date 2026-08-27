import {
	getGroupMembers,
	joinGroup,
	joinGroupByCode,
	leaveGroup,
	previewGroupByCode,
	previewGroupById,
	removeGroupMember,
	type RemoveGroupMemberInput
} from '@/api/memberships.api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupQueryKeys } from './queryKeys';

/**
 * Looking a code up is something the reader *does*, so it's a mutation rather than a
 * query. As a query it was `enabled` the moment an eighth character existed, which meant
 * typing the last character fired the request on its own — and "Grubu bul", disabled while
 * that automatic fetch was in flight, swallowed the first press. Only the second one, once
 * the stray request had settled, actually did anything.
 *
 * A mutation has no `enabled` to race: nothing runs until the button is pressed, `isPending`
 * describes that press and nothing else, and a 404 arrives as a rejection to catch.
 */
export const useLookupGroupByCode = () => useMutation({ mutationFn: (code: string) => previewGroupByCode(code) });

export const useGroupPreviewById = (groupId: string) => {
	return useQuery({
		queryKey: groupQueryKeys.previewByGroup(groupId),
		queryFn: () => previewGroupById(groupId),
		enabled: !!groupId
	});
};

export const useJoinGroupByCode = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (code: string) => joinGroupByCode(code),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useJoinGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: string) => joinGroup(groupId),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useLeaveGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: string) => leaveGroup(groupId),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useGetGroupMembers = (groupId: string) => {
	return useQuery({
		queryKey: groupQueryKeys.members(groupId),
		queryFn: () => getGroupMembers(groupId),
		enabled: !!groupId
	});
};

export const useRemoveGroupMember = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: RemoveGroupMemberInput) => removeGroupMember(input),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};
