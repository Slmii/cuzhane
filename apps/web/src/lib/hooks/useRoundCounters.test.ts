import { setRoundCounters, type SetRoundCountersInput } from '@/api/babs.api';
import type { RoundCounters } from '@/lib/types/domain';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupQueryKeys } from './queryKeys';
import { setRoundCountersOptions } from './useRoundCounters';

// The network is not what these are about — and the real module reaches for the app's config.
vi.mock('@/api/babs.api', () => ({ getRoundCounters: vi.fn(), setRoundCounters: vi.fn() }));

const GROUP = 'group_1';
const ROUND = 2;
const KEY = groupQueryKeys.roundCountersOf(GROUP, ROUND);

let client = new QueryClient();

afterEach(() => {
	client.clear();
	vi.mocked(setRoundCounters).mockReset();
});

/** A client holding the reader's counts as the screen last fetched them. */
const clientAt = (counters: Partial<RoundCounters>) => {
	client = new QueryClient();
	client.setQueryData<RoundCounters>(KEY, {
		delailCount: 0,
		istighfarCount: 0,
		istighfarTarget: 11,
		roundIndex: ROUND,
		...counters
	});

	return client;
};

/** The server: refuses the Delâil counts listed, confirms the rest. */
const serverRefusing = (...refused: number[]) =>
	vi.mocked(setRoundCounters).mockImplementation(async ({ delailCount }: SetRoundCountersInput) => {
		if (delailCount !== undefined && refused.includes(delailCount)) {
			throw new Error('refused');
		}

		return { delailCount: delailCount ?? 0, istighfarCount: 0, istighfarTarget: 11, roundIndex: ROUND };
	});

const tap = (queryClient: QueryClient, input: Omit<SetRoundCountersInput, 'groupId' | 'roundIndex'>) =>
	new MutationObserver(queryClient, setRoundCountersOptions(queryClient))
		.mutate({ groupId: GROUP, roundIndex: ROUND, ...input })
		.catch(() => undefined);

const shown = (queryClient: QueryClient) => queryClient.getQueryData<RoundCounters>(KEY);

describe('setRoundCountersOptions', () => {
	it('sends queued taps one after another, in the order they were made', async () => {
		serverRefusing();
		const queryClient = clientAt({});

		await Promise.all([1, 2, 3].map(delailCount => tap(queryClient, { delailCount })));

		expect(vi.mocked(setRoundCounters).mock.calls.map(([input]) => input.delailCount)).toEqual([1, 2, 3]);
	});

	it('moves the number on the tap, and changes only the count tapped', async () => {
		vi.mocked(setRoundCounters).mockImplementation(() => new Promise<RoundCounters>(() => {}));
		const queryClient = clientAt({ istighfarCount: 4, istighfarTarget: 33 });

		void tap(queryClient, { delailCount: 2 });

		await vi.waitFor(() => expect(shown(queryClient)?.delailCount).toBe(2));
		expect(shown(queryClient)).toMatchObject({ istighfarCount: 4, istighfarTarget: 33 });
	});

	it('keeps the latest tap on screen when one in the middle of the queue fails', async () => {
		serverRefusing(1);
		const queryClient = clientAt({});

		await Promise.all([1, 2, 3].map(delailCount => tap(queryClient, { delailCount })));

		expect(shown(queryClient)?.delailCount).toBe(3);
	});

	it('puts the count back when the only write fails', async () => {
		serverRefusing(2);
		const queryClient = clientAt({ delailCount: 1 });

		await tap(queryClient, { delailCount: 2 });

		expect(shown(queryClient)?.delailCount).toBe(1);
	});
});
