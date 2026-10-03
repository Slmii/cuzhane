import { getRoundCounters, setRoundCounters, type SetRoundCountersInput } from '@/api/babs.api';
import type { RoundCounters } from '@/lib/types/domain';
import type { DelailProgress, IstighfarProgress } from '@/screens/Hizb/HizbBody.types';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupQueryKeys } from './queryKeys';

/** Shared by every counter write, so a settling or failing one can tell whether others are queued. */
const SET_ROUND_COUNTERS_KEY = ['setRoundCounters'] as const;
const ISTIGHFAR_TARGET_DEFAULT = 11;

/** Whether a counter write other than the one asking is still on its way. */
const hasQueuedWrites = (queryClient: QueryClient) =>
	queryClient.isMutating({ mutationKey: SET_ROUND_COUNTERS_KEY }) > 1;

/**
 * `useRoundCounters`' write, shaped as Sekine's (`setRepetitionsOptions`) for the same reasons: the
 * number moves on the tap, writes run one after another so an absolute 2 can't land after the 3,
 * a failed write is not rolled back while later ones are queued, and the counts are fetched once
 * after the last.
 */
export const setRoundCountersOptions = (queryClient: QueryClient) => ({
	mutationKey: SET_ROUND_COUNTERS_KEY,
	scope: { id: 'setRoundCounters' },
	mutationFn: (input: SetRoundCountersInput) => setRoundCounters(input),
	onMutate: async ({ groupId, roundIndex, delailCount, istighfarCount, istighfarTarget }: SetRoundCountersInput) => {
		const queryKey = groupQueryKeys.roundCountersOf(groupId, roundIndex);

		await queryClient.cancelQueries({ queryKey });
		const previous = queryClient.getQueryData<RoundCounters>(queryKey);

		if (previous) {
			queryClient.setQueryData<RoundCounters>(queryKey, {
				...previous,
				...(delailCount === undefined ? {} : { delailCount }),
				...(istighfarCount === undefined ? {} : { istighfarCount }),
				...(istighfarTarget === undefined ? {} : { istighfarTarget })
			});
		}

		return { previous };
	},
	onError: (
		_error: Error,
		{ groupId, roundIndex }: SetRoundCountersInput,
		context: { previous: RoundCounters | undefined } | undefined
	) => {
		if (hasQueuedWrites(queryClient) || !context?.previous) {
			return;
		}

		queryClient.setQueryData(groupQueryKeys.roundCountersOf(groupId, roundIndex), context.previous);
	},
	// Every group's counts, not the last write's: the queue is shared, so a failed write to another
	// group may have skipped its own rollback while this one was still queued.
	onSettled: async () => {
		if (hasQueuedWrites(queryClient)) {
			return;
		}

		await queryClient.invalidateQueries({ queryKey: [...groupQueryKeys.root(), 'round-counters'] });
	}
});

/**
 * A seat-divided Hizb group's Delâil and istighfar counters, kept on the server for the viewer and
 * the round — so closing the app does not send a reader back to zero. Shaped as the reader's own
 * progress props, so `HizbBody` draws them as it drew the session-only ones.
 *
 * Inert until the round's counts have answered: a tap on a count not yet known would write over
 * the one that is.
 */
export const useRoundCounters = (
	groupId: string,
	roundIndex: number | null,
	{
		isEnabled,
		isOpenRound,
		onWriteError,
		onWriteSuccess
	}: {
		isEnabled: boolean;
		isOpenRound: boolean;
		/** A write refused — the screen says why; a 409 is the round having moved on at midnight. */
		onWriteError?: (error: Error) => void;
		onWriteSuccess?: () => void;
	}
): {
	delailProgress: DelailProgress;
	istighfarProgress: IstighfarProgress;
	isLoaded: boolean;
	/** The fetch itself, for the reader's retry and pull-to-refresh. */
	query: typeof query;
} => {
	const queryClient = useQueryClient();
	const round = roundIndex ?? -1;
	const query = useQuery({
		queryKey: groupQueryKeys.roundCountersOf(groupId, round),
		queryFn: () => getRoundCounters(groupId, round),
		enabled: !!groupId && isEnabled && roundIndex !== null
	});
	const { mutate } = useMutation(setRoundCountersOptions(queryClient));
	const counters = query.data;
	const isDisabled = counters === undefined || roundIndex === null;

	const write = (patch: Pick<SetRoundCountersInput, 'delailCount' | 'istighfarCount' | 'istighfarTarget'>) => {
		if (roundIndex !== null) {
			mutate(
				{ groupId, isOpenRound, roundIndex, ...patch },
				{
					...(onWriteError ? { onError: onWriteError } : {}),
					...(onWriteSuccess ? { onSuccess: onWriteSuccess } : {})
				}
			);
		}
	};

	return {
		// The counts are known — what the reader's page lock waits for, so a fetch that failed never
		// holds a page shut behind a counter nobody can tap.
		isLoaded: !isDisabled,
		query,
		delailProgress: {
			count: counters?.delailCount ?? 0,
			disabled: isDisabled,
			onChange: count => write({ delailCount: count })
		},
		istighfarProgress: {
			count: counters?.istighfarCount ?? 0,
			target: counters?.istighfarTarget ?? ISTIGHFAR_TARGET_DEFAULT,
			disabled: isDisabled,
			onChange: patch =>
				write({
					...(patch.istighfarRepetitions === undefined ? {} : { istighfarCount: patch.istighfarRepetitions }),
					...(patch.istighfarTarget === undefined ? {} : { istighfarTarget: patch.istighfarTarget })
				})
		}
	};
};
