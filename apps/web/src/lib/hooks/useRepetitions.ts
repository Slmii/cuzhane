import { getRepetitions, setRepetitions, type SetRepetitionsInput } from '@/api/babs.api';
import type { PartRepetitions } from '@/lib/types/domain';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupQueryKeys } from './queryKeys';

/** Shared by every count write, so a settling or failing one can tell whether others are queued. */
const SET_REPETITIONS_KEY = ['setRepetitions'] as const;

/**
 * The viewer's count on a part that must be repeated before it counts — the Hizb's Sekine.
 *
 * **`roundIndex` is required**: `group.roundIndex` for the open round, the covered round's own
 * index otherwise, and the same number to `useSetRepetitions`. The cache is keyed by it, and it
 * is always sent, so the open round has one identity rather than two — a "current" key beside a
 * numbered one let a write land on a key the screen wasn't reading, and carried a count across
 * the rollover.
 *
 * `isEnabled` because only a repeated part has a count at all — asking about any other is a 400,
 * and the reader calls its hooks for every part it opens. The same shape as `useGetMyProgress`.
 */
export const useGetRepetitions = (groupId: string, babNumber: number, roundIndex: number, isEnabled = true) =>
	useQuery({
		queryKey: groupQueryKeys.partRepetitions(groupId, babNumber, roundIndex),
		queryFn: () => getRepetitions(groupId, babNumber, roundIndex),
		enabled: !!groupId && isEnabled
	});

/** Whether a count write other than the one asking is still on its way. */
const hasQueuedWrites = (queryClient: QueryClient) =>
	// The asking write is still counted as in flight while its callbacks run, hence 1 and not 0.
	queryClient.isMutating({ mutationKey: SET_REPETITIONS_KEY }) > 1;

/**
 * `useSetRepetitions`' options, apart so they can be exercised against a bare `QueryClient`.
 *
 * The cancel/snapshot/rollback shape of `useSetBabRead` — the number moves on the tap — with
 * three differences, all because nineteen taps in a row are nineteen **absolute** writes:
 *
 * - **Serial, by `scope`.** Two in flight at once can land in either order, and the 5 arriving
 *   after the 6 would leave the server a tap behind the reader. Each `onMutate` still runs on its
 *   own tap, so the number never waits for the queue.
 * - **No rollback while later writes are queued.** A later absolute write supersedes the failed
 *   one; restoring its snapshot would drop the screen back under the reader's thumb, and the next
 *   tap would then send that stale number — overwriting what the queued writes had just saved.
 * - **Refetched once, after the last** — and the whole group's counts, not one key, so a write
 *   to another round is reconciled too. Invalidating as each settled would fetch the count the
 *   server had so far while later taps were still queued.
 */
export const setRepetitionsOptions = (queryClient: QueryClient) => ({
	mutationKey: SET_REPETITIONS_KEY,
	scope: { id: 'setRepetitions' },
	mutationFn: (input: SetRepetitionsInput) => setRepetitions(input),
	onMutate: async ({ groupId, babNumber, count, roundIndex }: SetRepetitionsInput) => {
		const queryKey = groupQueryKeys.partRepetitions(groupId, babNumber, roundIndex);

		await queryClient.cancelQueries({ queryKey });
		const previous = queryClient.getQueryData<PartRepetitions>(queryKey);

		if (previous) {
			queryClient.setQueryData<PartRepetitions>(queryKey, { ...previous, count });
		}

		return { previous };
	},
	onError: (
		_error: Error,
		{ groupId, babNumber, roundIndex }: SetRepetitionsInput,
		context: { previous: PartRepetitions | undefined } | undefined
	) => {
		if (hasQueuedWrites(queryClient)) {
			return;
		}

		if (context?.previous) {
			queryClient.setQueryData(groupQueryKeys.partRepetitions(groupId, babNumber, roundIndex), context.previous);
		}
	},
	onSettled: async (_data: PartRepetitions | undefined, _error: Error | null, { groupId }: SetRepetitionsInput) => {
		if (hasQueuedWrites(queryClient)) {
			return;
		}

		await queryClient.invalidateQueries({ queryKey: groupQueryKeys.repetitions(groupId) });
	}
});

/** Sets the count, absolutely — see `setRepetitionsOptions` for why it is shaped the way it is. */
export const useSetRepetitions = () => {
	const queryClient = useQueryClient();

	return useMutation(setRepetitionsOptions(queryClient));
};
