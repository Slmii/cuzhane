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
import type { GroupSummary } from '@/lib/types/domain';
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

/**
 * Leaving takes the group off the shelf immediately, before the server answers.
 *
 * Optimistic because the screen navigates away on success: without it the reader lands back
 * on Gruplarım and the group they just left is still sitting there until the refetch
 * returns, which reads as the action having failed. The same cancel/snapshot/rollback shape
 * as `useSetBabRead`.
 *
 * Only the shelf is written by hand. Keşfet is a server-side query that excludes groups you
 * belong to, so the group reappears there on the invalidation below — guessing at that list
 * locally would mean reproducing its filters and sort in two places.
 */
export const useLeaveGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: string) => leaveGroup(groupId),
		onMutate: async (groupId: string) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.groups() });

			const previousGroups = queryClient.getQueryData<GroupSummary[]>(groupQueryKeys.groups());

			if (previousGroups) {
				queryClient.setQueryData<GroupSummary[]>(
					groupQueryKeys.groups(),
					previousGroups.filter(group => group.id !== groupId)
				);
			}

			return { previousGroups };
		},
		onError: (_error, _groupId, context) => {
			if (context?.previousGroups) {
				queryClient.setQueryData(groupQueryKeys.groups(), context.previousGroups);
			}
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

/**
 * `isEnabled` lets a caller that is currently invisible stop subscribing.
 *
 * The members sheet is the case: it stays mounted behind a closed `AppBottomSheet`, so
 * without this its query kept refetching in the background and every refetch rebuilt a row —
 * avatar, progress bar, the lot — for a surface nobody could see. Cached data survives, so
 * reopening is still instant after the first look.
 */
export const useGetGroupMembers = (groupId: string, isEnabled = true) => {
	return useQuery({
		queryKey: groupQueryKeys.members(groupId),
		queryFn: () => getGroupMembers(groupId),
		enabled: !!groupId && isEnabled
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
