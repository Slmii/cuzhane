import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { getBabs, setAllBabsRead, type SetAllBabsReadInput, setBabRead, type SetBabReadInput } from '@/api/babs.api';
import { GroupBab, GroupSummary } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
import { groupQueryKeys, profileQueryKeys } from './queryKeys';

/**
 * A group summary with the viewer's share marked read, or unread.
 *
 * Home's ring is driven entirely by these two numbers — `myReadCount` against the size of
 * `myBabNumbers` — and never by the board, which that screen doesn't even fetch. Painting
 * only the board optimistically left the ring waiting on the round trip, so the app's
 * primary action sat there for a moment doing nothing visible.
 *
 * `myReadCount` counts babs in the share read by *anyone*, so marking all read makes it
 * exactly the share's size. Clearing is the imprecise direction — a bab of yours that
 * somebody else read this round stays read — so this guesses zero and lets the refetch
 * correct it. On Home that guess is almost always right, and it is wrong only by a bab or
 * two for the moment it stands.
 */
const withShareRead = (group: GroupSummary, read: boolean): GroupSummary => ({
	...group,
	myReadCount: read ? group.myBabNumbers.length : 0,
	myNextBabNumber: read ? null : group.myBabNumbers[0] ?? null
});

export const useGetBabs = (groupId: string) => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.babs(groupId),
		queryFn: () => getBabs(groupId),
		enabled: !!groupId,
		refetchInterval
	});
};

export const useSetAllBabsRead = () => {
	const queryClient = useQueryClient();
	const userId = useCurrentUserId();

	return useMutation({
		mutationFn: (input: SetAllBabsReadInput) => setAllBabsRead(input),
		onMutate: async ({ groupId, read }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.babs(groupId) });
			const previousBabs = queryClient.getQueryData<GroupBab[]>(groupQueryKeys.babs(groupId));

			// Which babs are "mine" comes from the cached group, not from `assignedUserId`:
			// that field is the seat's standing owner and does not rotate, so from round 1 of
			// a ROTATION group it names a different block than the one the server is about to
			// mark. Guessing wrong here would flip the wrong cells and then snap back.
			//
			// Both caches are checked because the two callers populate different ones: the
			// group screen loads `groupById`, while Home only ever fetches the list.
			const cachedGroup =
				queryClient.getQueryData<GroupSummary>(groupQueryKeys.groupById(groupId)) ??
				queryClient
					.getQueryData<GroupSummary[]>(groupQueryKeys.groups())
					?.find(candidate => candidate.id === groupId);
			const mine = new Set(cachedGroup?.myBabNumbers ?? []);

			// The Home button is the app's primary action, so the ring has to flip on the
			// same frame as the tap rather than after a round trip. With no cached group to
			// tell us the share, skip the guess and let the refetch settle it.
			if (previousBabs && userId && mine.size > 0) {
				queryClient.setQueryData<GroupBab[]>(
					groupQueryKeys.babs(groupId),
					previousBabs.map(bab =>
						mine.has(bab.number)
							? {
									...bab,
									readByUserId: read ? userId : null,
									readAt: read ? bab.readAt ?? new Date().toISOString() : null
							  }
							: bab
					)
				);
			}

			/*
			 * The same flip on the summaries the ring and the group heading actually read from.
			 * Both caches, because the two callers populate different ones — Home has only the
			 * list, the group screen has `groupById`.
			 */
			const previousGroups = queryClient.getQueryData<GroupSummary[]>(groupQueryKeys.groups());
			const previousGroup = queryClient.getQueryData<GroupSummary>(groupQueryKeys.groupById(groupId));

			if (previousGroups) {
				queryClient.setQueryData<GroupSummary[]>(
					groupQueryKeys.groups(),
					previousGroups.map(group => (group.id === groupId ? withShareRead(group, read) : group))
				);
			}

			if (previousGroup) {
				queryClient.setQueryData<GroupSummary>(
					groupQueryKeys.groupById(groupId),
					withShareRead(previousGroup, read)
				);
			}

			return { previousBabs, previousGroup, previousGroups };
		},
		onError: (_error, { groupId }, context) => {
			if (context?.previousBabs) {
				queryClient.setQueryData(groupQueryKeys.babs(groupId), context.previousBabs);
			}

			if (context?.previousGroups) {
				queryClient.setQueryData(groupQueryKeys.groups(), context.previousGroups);
			}

			if (context?.previousGroup) {
				queryClient.setQueryData(groupQueryKeys.groupById(groupId), context.previousGroup);
			}
		},
		onSettled: async (_data, _error, { groupId }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.babs(groupId) }),
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.groupById(groupId) }),
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.groups() }),
				queryClient.invalidateQueries({ queryKey: profileQueryKeys.stats() })
			]);
		}
	});
};

export const useSetBabRead = () => {
	const queryClient = useQueryClient();
	const userId = useCurrentUserId();

	return useMutation({
		mutationFn: (input: SetBabReadInput) => setBabRead(input),
		onMutate: async ({ groupId, babNumber, read }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.babs(groupId) });
			const previousBabs = queryClient.getQueryData<GroupBab[]>(groupQueryKeys.babs(groupId));

			if (previousBabs) {
				queryClient.setQueryData<GroupBab[]>(
					groupQueryKeys.babs(groupId),
					previousBabs.map(bab =>
						bab.number === babNumber
							? {
									...bab,
									// Assignment no longer implies who reads it, so the optimistic write
									// credits the current user rather than falling back to `assignedUserId`.
									readByUserId: read ? bab.readByUserId ?? userId : null,
									readAt: read ? new Date().toISOString() : null
							  }
							: bab
					)
				);
			}

			return { previousBabs };
		},
		onError: (_error, { groupId }, context) => {
			if (context?.previousBabs) {
				queryClient.setQueryData(groupQueryKeys.babs(groupId), context.previousBabs);
			}
		},
		onSettled: async (_data, _error, { groupId }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.babs(groupId) }),
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.groupById(groupId) }),
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.groups() }),
				queryClient.invalidateQueries({ queryKey: profileQueryKeys.stats() })
			]);
		}
	});
};
