import { getHints, markHintsSeen, resetHints } from '@/api/hints.api';
import type { HintsState } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hintsQueryKeys } from './queryKeys';

/**
 * The hints this account has seen. `isEnabled` holds it back until the settings have answered —
 * that is, until a session can sign a request: the hints mount at the app's root, above sign-in,
 * and a request without a token signs the reader out (`wrapper.api.ts`).
 */
export const useGetHints = (isEnabled: boolean) =>
	useQuery({
		enabled: isEnabled,
		queryFn: getHints,
		queryKey: hintsQueryKeys.state()
	});

/** Marks hints seen, at once in the cache and then on the server. */
export const useMarkHintsSeen = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (ids: string[]) => markHintsSeen(ids),
		onMutate: async ids => {
			await queryClient.cancelQueries({ queryKey: hintsQueryKeys.state() });
			const previous = queryClient.getQueryData<HintsState>(hintsQueryKeys.state());

			if (previous) {
				queryClient.setQueryData<HintsState>(hintsQueryKeys.state(), {
					...previous,
					seenIds: [...new Set([...previous.seenIds, ...ids])]
				});
			}

			return { previous };
		},
		onError: (_error, _ids, context) => {
			if (context?.previous) {
				queryClient.setQueryData(hintsQueryKeys.state(), context.previous);
			}
		},
		// The answer is the whole state already — no second request to fetch it. Ids still marked in
		// the cache by a later write in flight are kept, so its card is not counted unseen meanwhile.
		onSuccess: (state: HintsState) => {
			const current = queryClient.getQueryData<HintsState>(hintsQueryKeys.state());

			queryClient.setQueryData<HintsState>(hintsQueryKeys.state(), {
				...state,
				seenIds: [...new Set([...state.seenIds, ...(current?.seenIds ?? [])])]
			});
		}
	});
};

/** "İpuçlarını yeniden göster": every hint but the welcome comes back. */
export const useResetHints = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: resetHints,
		onSuccess: state => {
			queryClient.setQueryData(hintsQueryKeys.state(), state);
		}
	});
};
