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
	markPoolReleasesSeen,
	releasePoolSlot,
	startGroup,
	takePoolSlot,
	type TakePoolSlotInput,
	updateGroup,
	type UpdateGroupInput
} from '@/api/groups.api';
import type { PoolSlot } from '@/lib/types/domain';
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

/**
 * Üstlen, painted before the server agrees.
 *
 * Optimistic because the fill *is* the feedback: the block sweeps to your colour a cell at a
 * time, and waiting on the round trip to start it made the tap feel like it had missed. The
 * same cancel/snapshot/rollback shape as `useSetBabRead`.
 *
 * Only the slot's own three fields are written. Everything else the claim touches — the
 * board, the group's pool counts — is left to the invalidation, because a slot is taken whole
 * and those are derived from it rather than guessable here. Two people racing for one slot is
 * settled by the server's conditional update; the loser's optimistic fill is rolled back and
 * the refetch puts the winner's name on it.
 */
export const useTakePoolSlot = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: TakePoolSlotInput) => takePoolSlot(input),
		onMutate: async ({ groupId, slotIndex }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.pool(groupId) });

			const previousSlots = queryClient.getQueryData<PoolSlot[]>(groupQueryKeys.pool(groupId));

			if (previousSlots) {
				queryClient.setQueryData<PoolSlot[]>(
					groupQueryKeys.pool(groupId),
					previousSlots.map(slot =>
						slot.slotIndex === slotIndex ? { ...slot, takenByMe: true, takenByUserId: 'optimistic' } : slot
					)
				);
			}

			return { previousSlots };
		},
		onError: (_error, { groupId }, context) => {
			if (context?.previousSlots) {
				queryClient.setQueryData(groupQueryKeys.pool(groupId), context.previousSlots);
			}
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

/**
 * Handing a slot back — optimistic, like taking one, and for the same reason.
 *
 * The board drains the block the way it filled, reversed, and that sweep has to start on the
 * tap: run only once the server had answered, the undo sat still for a round trip and then
 * played to somebody who had already looked away.
 */
export const useReleasePoolSlot = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: TakePoolSlotInput) => releasePoolSlot(input),
		onMutate: async ({ groupId, slotIndex }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.pool(groupId) });

			const previousSlots = queryClient.getQueryData<PoolSlot[]>(groupQueryKeys.pool(groupId));

			if (previousSlots) {
				queryClient.setQueryData<PoolSlot[]>(
					groupQueryKeys.pool(groupId),
					previousSlots.map(slot =>
						slot.slotIndex === slotIndex
							? { ...slot, takenByDisplayName: null, takenByMe: false, takenByUserId: null }
							: slot
					)
				);
			}

			return { previousSlots };
		},
		onError: (_error, { groupId }, context) => {
			if (context?.previousSlots) {
				queryClient.setQueryData(groupQueryKeys.pool(groupId), context.previousSlots);
			}
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

/** Dismisses the notices telling the viewer a joiner took over a block they volunteered for. */
export const useMarkPoolReleasesSeen = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (groupId: string) => markPoolReleasesSeen(groupId),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};
