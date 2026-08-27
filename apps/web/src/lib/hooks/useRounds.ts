import { coverBabs, type CoverBabsInput, getRoundDetail, getRounds } from '@/api/rounds.api';
import { groupQueryKeys, profileQueryKeys } from '@/lib/hooks/queryKeys';
import { useLiveRefetchInterval } from '@/lib/hooks/useLiveRefetchInterval';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useGetRounds = (groupId: string) =>
	useQuery({
		queryKey: groupQueryKeys.rounds(groupId),
		queryFn: () => getRounds(groupId),
		enabled: !!groupId
	});

export const useGetRoundDetail = (groupId: string, roundIndex: number) => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: groupQueryKeys.round(groupId, roundIndex),
		queryFn: () => getRoundDetail(groupId, roundIndex),
		enabled: !!groupId && Number.isInteger(roundIndex) && roundIndex >= 0,
		// A closed round is settled history in every respect but one: anybody can still
		// cover what it left unread. Refetching on entry and while the screen is open is
		// what keeps a stale list from offering babs someone else has already taken.
		refetchOnMount: 'always',
		refetchInterval
	});
};

/**
 * Covers a bab a closed round left unread.
 *
 * Not optimistic, unlike the current round's reads: this one can legitimately lose. Someone
 * else covering the same bab first is a 409, and briefly showing it as yours before
 * snapping back would misreport whose read it is — the one thing this history exists to get
 * right. The server returns the whole round, so the screen updates from the truth.
 */
export const useCoverBabs = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CoverBabsInput) => coverBabs(input),
		onSuccess: (detail, { groupId, roundIndex }) => {
			queryClient.setQueryData(groupQueryKeys.round(groupId, roundIndex), detail);
		},
		onSettled: async (_data, _error, { groupId }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.rounds(groupId) }),
				// A cover is a read like any other, so the profile totals and streak move too.
				queryClient.invalidateQueries({ queryKey: profileQueryKeys.stats() })
			]);
		}
	});
};
