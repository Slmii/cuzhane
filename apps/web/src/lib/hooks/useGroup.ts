import { useIsTourDemo } from '@/components/Tour/Tour.context';
import { TOUR_DEMO_GROUPS, tourDemoGroup } from '@/components/Tour/tourDemoData';
import { tourDemoQueryKeys } from '@/lib/hooks/queryKeys';
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
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupSummary, PoolSlot } from '@/lib/types/domain';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
import { groupOwnedQueryKeys, groupQueryKeys } from './queryKeys';

/*
 * While the first-use tour is standing in for an account with no group of its own, this answers
 * from `tourDemoData` instead of the network — a different key, so the real one is left exactly
 * as it was and comes back untouched when the tour ends. `staleTime: Infinity` and a `queryFn`
 * that returns at once are not enough on their own: a `queryFn` is a promise however fast it
 * settles, so the first render after mount is still `isPending` and the group screen's gate is
 * exactly that — the skeleton flashed every time the tour navigated. `initialData` is what makes
 * the data there on the very first render, and with an infinite stale time nothing refetches
 * behind it. Given as a function, so the hundred babs are only built when they are wanted.
 */
export const useGetGroups = () => {
	const refetchInterval = useLiveRefetchInterval();
	const isDemo = useIsTourDemo();

	return useQuery({
		queryKey: isDemo ? tourDemoQueryKeys.groups() : groupQueryKeys.groups(),
		queryFn: isDemo ? async () => TOUR_DEMO_GROUPS : getGroups,
		...(isDemo ? { initialData: () => TOUR_DEMO_GROUPS, staleTime: Infinity } : { refetchInterval })
	});
};

export const useGetGroupById = (groupId: string) => {
	const refetchInterval = useLiveRefetchInterval();
	const isDemo = useIsTourDemo();

	return useQuery({
		queryKey: isDemo ? tourDemoQueryKeys.groupById(groupId) : groupQueryKeys.groupById(groupId),
		queryFn: isDemo ? async () => tourDemoGroup(groupId) : () => getGroupById(groupId),
		enabled: !!groupId,
		...(isDemo ? { initialData: () => tourDemoGroup(groupId), staleTime: Infinity } : { refetchInterval })
	});
};

export const useDiscoverGroups = (
	{ search, cycle }: DiscoverGroupsParams,
	// `isEnabled: false` keeps the query dormant — the search screen while its field is empty.
	{ isEnabled = true }: { isEnabled?: boolean } = {}
) => {
	return useQuery({
		enabled: isEnabled,
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

/**
 * **Deleting is optimistic and the sheet closes at once**, the same shape as `useLeaveGroup`
 * — and for the same reason, which bit harder here: the owner is looking at the group they
 * are deleting, through a sheet sitting on top of it.
 *
 * Waiting meant invalidating the whole `groups` root the instant the delete landed, which
 * sent every query belonging to a group that no longer exists off to refetch. Each got its
 * 404, each retried three times with backoff, the screen underneath went to "bir şeyler ters
 * gitti" — and only then did the navigation that was supposed to take you away from it fire.
 *
 * So the group's own keys are dropped rather than invalidated, and only the shelf is
 * invalidated, unawaited.
 */
export const useDeleteGroup = () => {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	return useMutation({
		mutationFn: (groupId: string) => deleteGroup(groupId),
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
		onSuccess: (_data, groupId) => {
			for (const queryKey of groupOwnedQueryKeys(groupId)) {
				queryClient.removeQueries({ queryKey });
			}
		},
		/*
		 * The alert lives here rather than at the call site: React Query discards `mutate`'s own
		 * callbacks once the calling component unmounts, and deleting closes the sheet that
		 * called it. A failed delete has to say so — the group reappearing on the shelf with no
		 * explanation reads as the app having ignored the tap.
		 */
		onError: (_error, _groupId, context) => {
			if (context?.previousGroups) {
				queryClient.setQueryData(groupQueryKeys.groups(), context.previousGroups);
			}
			Alert.alert(t('genericError'));
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: groupQueryKeys.groups() });
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
