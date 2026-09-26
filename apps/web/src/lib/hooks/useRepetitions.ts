import { getRepetitions, setRepetitions, type SetRepetitionsInput } from '@/api/babs.api';
import type { PartRepetitions } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupQueryKeys } from './queryKeys';

/** Shared by every count write, so `onSettled` can tell whether another is still on its way. */
const SET_REPETITIONS_KEY = ['setRepetitions'] as const;

/**
 * The viewer's count on a part that must be repeated before it counts — the Hizb's Sekine.
 *
 * **Pass the round**, `group.roundIndex` or the covered round, and pass the same value to
 * `useSetRepetitions`: the cache is keyed by it (see `partRepetitions`), so a count is never
 * carried from one round into the next. `null` asks for "the round in progress".
 *
 * `isEnabled` because only a repeated part has a count at all — asking about any other is a 400,
 * and the reader calls its hooks for every part it opens. The same shape as `useGetMyProgress`.
 */
export const useGetRepetitions = (
	groupId: string,
	babNumber: number,
	roundIndex: number | null = null,
	isEnabled = true
) =>
	useQuery({
		queryKey: groupQueryKeys.partRepetitions(groupId, babNumber, roundIndex),
		queryFn: () => getRepetitions(groupId, babNumber, roundIndex ?? undefined),
		enabled: !!groupId && isEnabled
	});

/**
 * Sets the count, absolutely, with the cancel/snapshot/rollback shape of `useSetBabRead`: the
 * number moves on the tap and a refused write puts the snapshot back.
 *
 * **Serial, by `scope`.** Nineteen taps in a row are nineteen absolute writes, and two in flight
 * at once can land in either order — the 5 arriving after the 6 would leave the server a tap
 * behind the reader. A shared scope runs them one after another; each `onMutate` still runs on
 * its own tap, so the number never waits for the queue.
 *
 * **Refetched once, after the last.** Invalidating as each write settled would fetch the count
 * the server had *so far* while later taps were still queued, and the number would step back
 * under the reader's thumb before catching up again.
 */
export const useSetRepetitions = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: SET_REPETITIONS_KEY,
		scope: { id: 'setRepetitions' },
		mutationFn: (input: SetRepetitionsInput) => setRepetitions(input),
		onMutate: async ({ groupId, babNumber, count, roundIndex }) => {
			const queryKey = groupQueryKeys.partRepetitions(groupId, babNumber, roundIndex ?? null);

			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData<PartRepetitions>(queryKey);

			if (previous) {
				queryClient.setQueryData<PartRepetitions>(queryKey, { ...previous, count });
			}

			return { previous };
		},
		onError: (_error, { groupId, babNumber, roundIndex }, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					groupQueryKeys.partRepetitions(groupId, babNumber, roundIndex ?? null),
					context.previous
				);
			}
		},
		onSettled: async (_data, _error, { groupId, babNumber, roundIndex }) => {
			// This write is still counted as in flight while it settles, hence 1 rather than 0.
			if (queryClient.isMutating({ mutationKey: SET_REPETITIONS_KEY }) > 1) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: groupQueryKeys.partRepetitions(groupId, babNumber, roundIndex ?? null)
			});
		}
	});
};
