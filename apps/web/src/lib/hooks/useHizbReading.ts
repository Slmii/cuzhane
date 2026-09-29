import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	enrollHizbReading,
	getHizbHistoryDay,
	getHizbHistoryDays,
	getHizbReading,
	getHizbAssignment,
	setHizbReadsFromBook,
	updateHizbAssignment,
	type HizbAssignment,
	type HizbAssignmentPatch
} from '@/api/hizbReading.api';
import { groupQueryKeys, profileQueryKeys } from './queryKeys';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
export const hizbReadingKey = (groupId: string) => ['groups', 'hizb-reading', groupId] as const;
export const hizbAssignmentKey = (groupId: string, id: string) =>
	[...hizbReadingKey(groupId), 'assignment', id] as const;
/** `isEnabled` off for a screen that serves every kind and only reads this for a Hizb group. */
export const useHizbReading = (groupId: string, isEnabled = true) => {
	const refetchInterval = useLiveRefetchInterval();
	return useInfiniteQuery({
		enabled: isEnabled,
		queryKey: [...hizbReadingKey(groupId), 'state'],
		queryFn: ({ pageParam }) => getHizbReading(groupId, pageParam),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: last => last.nextCursor ?? undefined,
		refetchInterval
	});
};
/** "Tüm geçmiş": the group's days, a page of thirty at a time. */
export const useHizbHistoryDays = (groupId: string) =>
	useInfiniteQuery({
		queryKey: [...hizbReadingKey(groupId), 'history'],
		queryFn: ({ pageParam }) => getHizbHistoryDays(groupId, pageParam),
		initialPageParam: undefined as number | undefined,
		getNextPageParam: last => last.nextBefore ?? undefined
	});
/** One day of "Tüm geçmiş": its readers. */
export const useHizbHistoryDay = (groupId: string, day: number | undefined) =>
	useQuery({
		enabled: day !== undefined,
		queryKey: [...hizbReadingKey(groupId), 'history', 'day', day],
		queryFn: () => getHizbHistoryDay(groupId, day ?? 0)
	});
export const useEnrollHizb = (groupId: string) => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (days: number) => enrollHizbReading(groupId, days),
		onSuccess: () => client.invalidateQueries({ queryKey: groupQueryKeys.root() })
	});
};
/** "Bu grupta hep kitaptan okuyorum" — kept on the account, per group. */
export const useSetHizbReadsFromBook = (groupId: string) => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (readsFromBook: boolean) => setHizbReadsFromBook(groupId, readsFromBook),
		onSuccess: () => client.invalidateQueries({ queryKey: hizbReadingKey(groupId) })
	});
};
export const useHizbAssignment = (groupId: string, id: string) =>
	useQuery({ queryKey: hizbAssignmentKey(groupId, id), queryFn: () => getHizbAssignment(groupId, id) });
export const useUpdateHizbAssignment = (groupId: string, id: string) => {
	const client = useQueryClient();
	const key = hizbAssignmentKey(groupId, id);
	const mutationKey = [...key, 'update'];

	return useMutation({
		mutationKey,
		/*
		 * **One write at a time, in tap order.** Each carries the version the server last
		 * answered with, and a stale one is refused — so counting "one more" quickly used to
		 * need the whole panel disabled between taps, and it faded on every tap. Queued in one
		 * scope, each write reads the version when it actually goes out.
		 */
		scope: { id: key.join(':') },
		/*
		 * The version is the cached reading's, read as the write goes out. A caller that has not
		 * opened the reader (the group screen's undo) passes the version its own data carries, so
		 * a cold cache never sends 0 against a reading that has moved on.
		 */
		// The newer of the two: a reader cache left behind can be older than the group screen's
		// fresh copy, and versions only ever go up, so the higher one is the one the server has.
		mutationFn: ({ version, ...patch }: Omit<HizbAssignmentPatch, 'version'> & { version?: number }) =>
			updateHizbAssignment(groupId, id, {
				...patch,
				version: Math.max(client.getQueryData<HizbAssignment>(key)?.version ?? 0, version ?? 0)
			}),
		/*
		 * Page turns and counts show at once rather than after the round trip — both are
		 * absolute values, so the next tap builds on the predicted one. Marking read is not
		 * predicted: the server decides whether the repetitions allow it.
		 */
		onMutate: async ({ read: _read, version: _version, bookPortions: _bookPortions, ...fields }) => {
			await client.cancelQueries({ queryKey: key });
			const previous = client.getQueryData<HizbAssignment>(key);

			if (previous) {
				client.setQueryData<HizbAssignment>(key, { ...previous, ...fields });
			}

			return { previous };
		},
		onSuccess: async (assignment, patch) => {
			// With more writes still queued, keep their predictions and take only the version.
			const isLast = client.isMutating({ mutationKey }) <= 1;
			client.setQueryData<HizbAssignment>(key, current =>
				isLast || !current ? assignment : { ...current, version: assignment.version }
			);
			if (patch.read !== undefined || patch.bookPortions !== undefined) {
				await Promise.all([
					client.invalidateQueries({ queryKey: groupQueryKeys.root() }),
					client.invalidateQueries({ queryKey: profileQueryKeys.root() })
				]);
			}
		},
		onError: (_error, _patch, context) => {
			if (context?.previous) {
				client.setQueryData(key, context.previous);
			}

			return client.invalidateQueries({ queryKey: key });
		}
	});
};
