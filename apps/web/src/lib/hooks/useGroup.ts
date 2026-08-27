import {
	createGroup,
	type CreateGroupInput,
	deleteGroup,
	discoverGroups,
	type DiscoverGroupsParams,
	getGroupById,
	getGroups,
	getPoolSlots,
	regenerateInviteCode,
	releasePoolSlot,
	startGroup,
	takePoolSlot,
	type TakePoolSlotInput,
	updateGroup,
	type UpdateGroupInput
} from '@/api/groups.api';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
import { groupQueryKeys } from './queryKeys';

export const useGetGroups = () => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.groups(),
		queryFn: getGroups,
		refetchInterval
	});
};

export const useGetGroupById = (groupId: string) => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.groupById(groupId),
		queryFn: () => getGroupById(groupId),
		enabled: !!groupId,
		refetchInterval
	});
};

export const useDiscoverGroups = ({ search, cycle }: DiscoverGroupsParams) => {
	return useQuery({
		queryKey: groupQueryKeys.discover(search, cycle),
		queryFn: () => discoverGroups({ search, cycle }),
		/**
		 * The cadence and the search term are part of the key, so changing either starts a
		 * *different* query — and without this the list would empty to a spinner and rebuild
		 * itself, which unmounts every card and leaves the reorder animation nothing to
		 * animate. Holding the previous rows keeps them on screen to move, fade out, or stay.
		 *
		 * It also stops the screen flashing a spinner on every keystroke of a search.
		 */
		placeholderData: keepPreviousData
	});
};

export const useCreateGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateGroupInput) => createGroup(input),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useUpdateGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UpdateGroupInput) => updateGroup(input),
		onSettled: async (_data, _error, input) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() }),
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.groupById(input.groupId) })
			]);
		}
	});
};

export const useDeleteGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: string) => deleteGroup(groupId),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useRegenerateInviteCode = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: string) => regenerateInviteCode(groupId),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useStartGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: string) => startGroup(groupId),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useGetPoolSlots = (groupId: string) => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.pool(groupId),
		queryFn: () => getPoolSlots(groupId),
		enabled: !!groupId,
		refetchInterval
	});
};

export const useTakePoolSlot = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: TakePoolSlotInput) => takePoolSlot(input),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useReleasePoolSlot = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: TakePoolSlotInput) => releasePoolSlot(input),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};
