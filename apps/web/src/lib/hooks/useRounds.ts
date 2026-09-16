import { useIsTourDemo } from '@/components/Tour/Tour.context';
import { tourDemoRounds } from '@/components/Tour/tourDemoData';
import { tourDemoQueryKeys } from '@/lib/hooks/queryKeys';
import { coverBabs, type CoverBabsInput, getRoundDetail, getRounds } from '@/api/rounds.api';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { groupQueryKeys, profileQueryKeys } from '@/lib/hooks/queryKeys';
import { useLiveRefetchInterval } from '@/lib/hooks/useLiveRefetchInterval';
import type { RoundDetail } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// See `useGetGroups` for why the tour answers its own queries.
export const useGetRounds = (groupId: string) => {
	const isDemo = useIsTourDemo();

	return useQuery({
		queryKey: isDemo ? tourDemoQueryKeys.rounds(groupId) : groupQueryKeys.rounds(groupId),
		queryFn: isDemo ? async () => tourDemoRounds(groupId) : () => getRounds(groupId),
		enabled: !!groupId,
		...(isDemo ? { initialData: () => tourDemoRounds(groupId), staleTime: Infinity } : {})
	});
};

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
/**
 * Üstlen on a closed round — optimistic, for the same reason the pool's is: the grid sweeping
 * to your colour is the confirmation, and starting it only once the server had answered read
 * as a tap that hadn't registered.
 *
 * The covered babs are marked read by the viewer straight away. The response is authoritative
 * and replaces the whole round on success; a failure rolls back to the snapshot.
 */
export const useCoverBabs = () => {
	const queryClient = useQueryClient();
	const userId = useCurrentUserId();

	return useMutation({
		mutationFn: (input: CoverBabsInput) => coverBabs(input),
		onMutate: async ({ babNumbers, groupId, roundIndex }) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.round(groupId, roundIndex) });

			const previousRound = queryClient.getQueryData<RoundDetail>(groupQueryKeys.round(groupId, roundIndex));

			if (previousRound && userId) {
				const covered = new Set(babNumbers);
				const readAt = new Date().toISOString();
				// Only the ones that were actually outstanding. A bab somebody else already read
				// is refused by the server (409) and must not be counted here either, or the
				// header would claim a bab that never moved.
				const babs = previousRound.babs.map(bab =>
					covered.has(bab.number) && bab.readByUserId === null
						? { ...bab, readAt, readByUserId: userId }
						: bab
				);
				const filled = babs.filter((bab, index) => bab !== previousRound.babs[index]).length;

				queryClient.setQueryData<RoundDetail>(groupQueryKeys.round(groupId, roundIndex), {
					...previousRound,
					babs,
					missedCount: Math.max(0, previousRound.missedCount - filled),
					readCount: previousRound.readCount + filled
				});
			}

			return { previousRound };
		},
		onError: (_error, { groupId, roundIndex }, context) => {
			if (context?.previousRound) {
				queryClient.setQueryData(groupQueryKeys.round(groupId, roundIndex), context.previousRound);
			}

			/*
			 * And then go and ask, because the most likely reason a cover fails is that somebody
			 * else got there first (409). Rolling back alone restores those babs as unread and
			 * offers them again — an action that can only fail the same way — until the poll
			 * eventually catches up. `onSettled` deliberately spares the detail, so it is asked
			 * for here instead.
			 */
			void queryClient.invalidateQueries({ queryKey: groupQueryKeys.round(groupId, roundIndex) });
		},
		onSuccess: (detail, { groupId, roundIndex }) => {
			queryClient.setQueryData(groupQueryKeys.round(groupId, roundIndex), detail);
		},
		onSettled: async (_data, _error, { groupId }) => {
			await Promise.all([
				/*
				 * `exact`, or this would also match the round *detail* below it — the key is a
				 * prefix of it — and throw away the authoritative copy `onSuccess` just wrote,
				 * refetching it a frame into the fill and re-rendering the grid mid-sweep. The
				 * list's per-round counts are the only thing here that actually went stale.
				 */
				queryClient.invalidateQueries({ queryKey: groupQueryKeys.rounds(groupId), exact: true }),
				// A cover is a read like any other, so the profile totals and streak move too.
				queryClient.invalidateQueries({ queryKey: profileQueryKeys.stats() })
			]);
		}
	});
};
