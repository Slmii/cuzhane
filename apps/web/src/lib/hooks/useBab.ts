import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { getBabs, setBabRead, type SetBabReadInput } from '@/api/babs.api';
import { GroupBab } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
import { groupQueryKeys, profileQueryKeys } from './queryKeys';

export const useGetBabs = (groupId: string, isEnabled = true) => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.babs(groupId),
		queryFn: () => getBabs(groupId),
		enabled: !!groupId && isEnabled,
		refetchInterval
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
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.pool(groupId) }),
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.groupById(groupId) }),
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.groups() }),
				queryClient.invalidateQueries({ queryKey: profileQueryKeys.stats() }),
				// The open period's cell and the completion rate both move on a read, and the
				// card sits on this very screen — without this it keeps yesterday's count.
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.myProgress(groupId) })
			]);
		}
	});
};
