import { setRepetitions, type SetRepetitionsInput } from '@/api/babs.api';
import type { PartRepetitions } from '@/lib/types/domain';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupQueryKeys } from './queryKeys';
import { setRepetitionsOptions } from './useRepetitions';

// The network is not what these are about — and the real module reaches for the app's config.
vi.mock('@/api/babs.api', () => ({ getRepetitions: vi.fn(), setRepetitions: vi.fn() }));

const GROUP = 'group_1';
const SEKINE = 19;
const ROUND = 2;
const KEY = groupQueryKeys.partRepetitions(GROUP, SEKINE, ROUND);

let client = new QueryClient();

afterEach(() => client.clear());

/** A client holding the reader's count as the screen last fetched it. */
const clientAt = (count: number) => {
	client = new QueryClient();
	client.setQueryData<PartRepetitions>(KEY, { count, required: 19, roundIndex: ROUND });

	return client;
};

/** The server: refuses the counts listed, confirms the rest. */
const serverRefusing = (...refused: number[]) =>
	vi.mocked(setRepetitions).mockImplementation(async ({ count }: SetRepetitionsInput) => {
		if (refused.includes(count)) {
			throw new Error('refused');
		}

		return { count, required: 19, roundIndex: ROUND };
	});

/** Taps once per count, all before the first answer arrives — nineteen taps in quick succession. */
const tapAll = (queryClient: QueryClient, counts: number[]) =>
	Promise.all(
		counts.map(count =>
			new MutationObserver(queryClient, setRepetitionsOptions(queryClient))
				.mutate({ babNumber: SEKINE, count, groupId: GROUP, roundIndex: ROUND })
				.catch(() => undefined)
		)
	);

const shownCount = (queryClient: QueryClient) => queryClient.getQueryData<PartRepetitions>(KEY)?.count;

describe('setRepetitionsOptions', () => {
	it('sends queued taps one after another, in the order they were made', async () => {
		serverRefusing();

		await tapAll(clientAt(5), [6, 7, 8]);

		expect(vi.mocked(setRepetitions).mock.calls.map(([input]) => input.count)).toEqual([6, 7, 8]);
	});

	it('moves the number on every tap, before any answer', async () => {
		// A server that never answers: the first request hangs and the other two queue behind it.
		vi.mocked(setRepetitions).mockImplementation(() => new Promise<PartRepetitions>(() => {}));
		const queryClient = clientAt(5);

		void tapAll(queryClient, [6, 7, 8]);

		await vi.waitFor(() => expect(shownCount(queryClient)).toBe(8));
		expect(vi.mocked(setRepetitions)).toHaveBeenCalledTimes(1);
	});

	it('keeps the latest tap on screen when one in the middle of the queue fails', async () => {
		// The 6 fails with the 7 and 8 still queued behind it. Rolling back to its snapshot put 5
		// on screen, and the next tap then sent 6 — over the 8 the server had just saved.
		serverRefusing(6);
		const queryClient = clientAt(5);

		await tapAll(queryClient, [6, 7, 8]);

		expect(shownCount(queryClient)).toBe(8);
	});

	it('puts the snapshot back when the write that fails is the last one', async () => {
		serverRefusing(6);
		const queryClient = clientAt(5);

		await tapAll(queryClient, [6]);

		expect(shownCount(queryClient)).toBe(5);
	});

	it('refetches every count the group has once the last write settles, other rounds included', async () => {
		serverRefusing();
		const queryClient = clientAt(5);
		const otherRound = groupQueryKeys.partRepetitions(GROUP, SEKINE, ROUND - 1);
		const otherGroup = groupQueryKeys.partRepetitions('group_2', SEKINE, ROUND);

		queryClient.setQueryData<PartRepetitions>(otherRound, { count: 19, required: 19, roundIndex: ROUND - 1 });
		queryClient.setQueryData<PartRepetitions>(otherGroup, { count: 3, required: 19, roundIndex: ROUND });

		await tapAll(queryClient, [6, 7]);

		expect(queryClient.getQueryState(KEY)?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(otherRound)?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(otherGroup)?.isInvalidated).toBe(false);
	});
});
