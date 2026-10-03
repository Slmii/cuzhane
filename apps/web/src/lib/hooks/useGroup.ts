import {
	createGroup,
	type CreateGroupInput,
	deleteGroup,
	discoverGroups,
	type DiscoverGroupsParams,
	getGroupById,
	getGroups,
	getPoolCuz,
	getPoolSlots,
	type PoolCuzInput,
	regenerateInviteCode,
	markPoolReleasesSeen,
	pickRoundCuz,
	releasePoolCuz,
	releasePoolPart,
	releasePoolSlot,
	skipRound,
	startGroup,
	takePoolCuz,
	takePoolPart,
	type TakePoolPartInput,
	takePoolSlot,
	type TakePoolSlotInput,
	updateGroup,
	type UpdateGroupInput
} from '@/api/groups.api';
import { WrapperApiError } from '@/api/wrapper.api';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupSummary, PoolCuz, PoolSlot } from '@/lib/types/domain';
import { withPoolPartReleased, withPoolPartTaken, withPoolSlotReleased, withPoolSlotTaken } from '@/lib/utils/pool';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
import { groupOwnedQueryKeys, groupQueryKeys } from './queryKeys';

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

export const useGetPoolSlots = (
	groupId: string,
	// `isEnabled: false` keeps it dormant — a hatim's havuz is cüz, and has no seat slots to ask for;
	// a non-FLEXIBLE group screen has no use for them either.
	{ isEnabled = true }: { isEnabled?: boolean } = {}
) => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.pool(groupId),
		queryFn: () => getPoolSlots(groupId),
		enabled: !!groupId && isEnabled,
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
 * Only the pool cache is written — the slot and its parts, together (`withPoolSlotTaken`), so a
 * portion write landing before the refetch works from the claim rather than wiping it.
 * Everything else the claim touches — the board, the group's pool counts — is left to the
 * invalidation, because those are derived from the claim rather than guessable here. Two people
 * racing for one slot is settled by the server's conditional update; the loser's optimistic
 * fill is rolled back and the refetch puts the winner's name on it.
 */
export const useTakePoolSlot = () => {
	const queryClient = useQueryClient();
	const userId = useCurrentUserId();

	return useMutation({
		mutationFn: (input: TakePoolSlotInput) => takePoolSlot(input),
		onMutate: async ({ groupId, slotIndex }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.pool(groupId) });

			const previousSlots = queryClient.getQueryData<PoolSlot[]>(groupQueryKeys.pool(groupId));

			if (previousSlots) {
				queryClient.setQueryData<PoolSlot[]>(
					groupQueryKeys.pool(groupId),
					// 'optimistic' stands in for the viewer when Clerk has no session to name.
					withPoolSlotTaken(previousSlots, slotIndex, userId ?? 'optimistic')
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
					withPoolSlotReleased(previousSlots, slotIndex)
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
 * One Hizb portion out of the pool, painted before the server agrees — `useTakePoolSlot`
 * narrowed to a single part, and optimistic for the same reason: the fill is the feedback.
 *
 * Only the pool cache is written, as the slot hook writes only it; the board and the group's
 * pool counts are derived from the claim and left to the invalidation. `withPoolPartTaken`
 * moves nothing somebody else already holds, so a 409 has nothing to roll back but the snapshot.
 */
export const useTakePoolPart = () => {
	const queryClient = useQueryClient();
	const userId = useCurrentUserId();

	return useMutation({
		mutationFn: (input: TakePoolPartInput) => takePoolPart(input),
		onMutate: async ({ groupId, babNumber }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.pool(groupId) });

			const previousSlots = queryClient.getQueryData<PoolSlot[]>(groupQueryKeys.pool(groupId));

			if (previousSlots) {
				queryClient.setQueryData<PoolSlot[]>(
					groupQueryKeys.pool(groupId),
					// The same stand-in the slot hook uses when Clerk has no session to name.
					withPoolPartTaken(previousSlots, babNumber, userId ?? 'optimistic')
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

/** Handing one portion back — optimistic, like taking it, so the drain starts on the tap. */
export const useReleasePoolPart = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: TakePoolPartInput) => releasePoolPart(input),
		onMutate: async ({ groupId, babNumber }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.pool(groupId) });

			const previousSlots = queryClient.getQueryData<PoolSlot[]>(groupQueryKeys.pool(groupId));

			if (previousSlots) {
				queryClient.setQueryData<PoolSlot[]>(
					groupQueryKeys.pool(groupId),
					withPoolPartReleased(previousSlots, babNumber)
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
 * The hatim's havuz — the same three hooks as the seat pool, one unit apart.
 *
 * Its own query key: the shapes differ (a cüz is not a slot), so sharing one would mean a
 * screen reading whichever kind happened to have been fetched last.
 */
export const useGetPoolCuz = (groupId: string) => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.poolCuz(groupId),
		queryFn: () => getPoolCuz(groupId),
		enabled: !!groupId,
		refetchInterval
	});
};

/**
 * Taking one, optimistically: the cell fills on the tap rather than on the answer, because
 * the fill *is* the confirmation. Two people racing for one cüz is settled by the unique key
 * on the server; the loser's paint is rolled back and the refetch names the winner.
 */
export const useTakePoolCuz = () => {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	return useMutation({
		mutationFn: (input: PoolCuzInput) => takePoolCuz(input),
		onMutate: async ({ cuzNumber, groupId }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.poolCuz(groupId) });

			const previousCuz = queryClient.getQueryData<PoolCuz[]>(groupQueryKeys.poolCuz(groupId));

			if (previousCuz) {
				queryClient.setQueryData<PoolCuz[]>(
					groupQueryKeys.poolCuz(groupId),
					previousCuz.map(cuz =>
						cuz.cuzNumber === cuzNumber ? { ...cuz, takenByMe: true, takenByUserId: 'optimistic' } : cuz
					)
				);
			}

			return { previousCuz };
		},
		/*
		 * The rollback, **and a reason**: a refused take used to put the cell back and say
		 * nothing, which read as the button ignoring the tap. 409 is somebody else getting there
		 * first; 400 is the group's per-member cap.
		 */
		onError: (error, { groupId }, context) => {
			if (context?.previousCuz) {
				queryClient.setQueryData(groupQueryKeys.poolCuz(groupId), context.previousCuz);
			}

			const status = error instanceof WrapperApiError ? error.status : null;

			Alert.alert(t(status === 409 ? 'poolCuzGone' : status === 400 ? 'poolTakeRefused' : 'genericError'));
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

/** Handing one back — optimistic for the same reason, so the cell empties on the tap. */
export const useReleasePoolCuz = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: PoolCuzInput) => releasePoolCuz(input),
		onMutate: async ({ cuzNumber, groupId }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.poolCuz(groupId) });

			const previousCuz = queryClient.getQueryData<PoolCuz[]>(groupQueryKeys.poolCuz(groupId));

			if (previousCuz) {
				queryClient.setQueryData<PoolCuz[]>(
					groupQueryKeys.poolCuz(groupId),
					previousCuz.map(cuz =>
						cuz.cuzNumber === cuzNumber
							? { ...cuz, takenByDisplayName: null, takenByMe: false, takenByUserId: null }
							: cuz
					)
				);
			}

			return { previousCuz };
		},
		onError: (_error, { groupId }, context) => {
			if (context?.previousCuz) {
				queryClient.setQueryData(groupQueryKeys.poolCuz(groupId), context.previousCuz);
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

/**
 * QR1's two answers. Neither is optimistic: the round-start screen waits on the answer before
 * it lets the member into the group, so there is no paint to get ahead of. Everything under the
 * group root is refreshed afterwards — the detail's holdings and skip flag are what the gate
 * reads, and the havuz and progress screens both change with them.
 */
export const usePickRoundCuz = () => {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	return useMutation({
		mutationFn: (input: { cuzNumbers: number[]; groupId: string }) => pickRoundCuz(input),
		// A 409 is somebody taking one of these cüz first — worth saying as that, since the
		// refreshed map will show which. Anything else is the app's ordinary apology.
		onError: error => {
			Alert.alert(t(error instanceof WrapperApiError && error.status === 409 ? 'qCuzJustTaken' : 'genericError'));
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useSkipRound = () => {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	return useMutation({
		mutationFn: (groupId: string) => skipRound(groupId),
		onError: () => {
			Alert.alert(t('genericError'));
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};
