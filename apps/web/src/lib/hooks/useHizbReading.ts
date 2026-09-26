import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	enrollHizbReading,
	getHizbReading,
	getHizbAssignment,
	updateHizbAssignment,
	type HizbAssignmentPatch
} from '@/api/hizbReading.api';
import { groupQueryKeys, profileQueryKeys } from './queryKeys';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
export const hizbReadingKey = (groupId: string) => ['groups', 'hizb-reading', groupId] as const;
export const hizbAssignmentKey = (groupId: string, id: string) =>
	[...hizbReadingKey(groupId), 'assignment', id] as const;
export const useHizbReading = (groupId: string) => {
	const refetchInterval = useLiveRefetchInterval();
	return useInfiniteQuery({
		queryKey: [...hizbReadingKey(groupId), 'state'],
		queryFn: ({ pageParam }) => getHizbReading(groupId, pageParam),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: last => last.nextCursor ?? undefined,
		refetchInterval
	});
};
export const useEnrollHizb = (groupId: string) => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (days: number) => enrollHizbReading(groupId, days),
		onSuccess: () => client.invalidateQueries({ queryKey: groupQueryKeys.root() })
	});
};
export const useHizbAssignment = (groupId: string, id: string) =>
	useQuery({ queryKey: hizbAssignmentKey(groupId, id), queryFn: () => getHizbAssignment(groupId, id) });
export const useUpdateHizbAssignment = (groupId: string, id: string) => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (patch: HizbAssignmentPatch) => updateHizbAssignment(groupId, id, patch),
		onSuccess: async (assignment, patch) => {
			client.setQueryData(hizbAssignmentKey(groupId, id), assignment);
			if (patch.read !== undefined) {
				await Promise.all([
					client.invalidateQueries({ queryKey: groupQueryKeys.root() }),
					client.invalidateQueries({ queryKey: profileQueryKeys.root() })
				]);
			}
		},
		onError: () => client.invalidateQueries({ queryKey: hizbAssignmentKey(groupId, id) })
	});
};
