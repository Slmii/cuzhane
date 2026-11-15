import type { GroupCycle, GroupKind, GroupStatus } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import {
	applyGroupBrowse,
	CYCLE_FILTER_OPTIONS,
	emptyGroupBrowseState,
	isGroupBrowseMenuActive,
	isGroupBrowseNarrowed,
	KIND_FILTER_OPTIONS,
	type GroupBrowseState
} from './groupBrowse';

type TestGroup = {
	createdAt: string;
	cycle: GroupCycle;
	isFull: boolean;
	kind: GroupKind;
	name: string;
	spotsLeft: number;
	status: GroupStatus;
};

/**
 * `isFull` follows `spotsLeft` unless a fixture says otherwise.
 *
 * That is the relationship a Cevşen group has, and most of these are Cevşen groups — stated
 * separately they drift, and a fixture claiming two free seats *and* being full tests
 * nothing real. A hatim is the case where the two genuinely come apart, so those pass it.
 */
const group = (over: Partial<TestGroup> = {}): TestGroup => {
	const spotsLeft = over.spotsLeft ?? 2;

	return {
		createdAt: '2026-01-01T00:00:00.000Z',
		cycle: 'WEEKLY',
		isFull: spotsLeft <= 0,
		kind: 'CEVSEN',
		name: 'Şifa Hatmi',
		spotsLeft,
		status: 'RUNNING',
		...over
	};
};

const state = (over: Partial<GroupBrowseState> = {}): GroupBrowseState => ({ ...emptyGroupBrowseState, ...over });

describe('CYCLE_FILTER_OPTIONS', () => {
	it('offers every cadence a group can have, after "all"', () => {
		expect(CYCLE_FILTER_OPTIONS).toEqual([undefined, 'DAILY', 'WEEKLY', 'MONTHLY']);
	});
});

describe('KIND_FILTER_OPTIONS', () => {
	it('offers every kind a group can read, after "all"', () => {
		expect(KIND_FILTER_OPTIONS).toEqual([undefined, 'CEVSEN', 'HATIM', 'HIZB']);
	});
});

describe('applyGroupBrowse — room to join', () => {
	it('hides a full hatim from "has room", though its seats are free', () => {
		/*
		 * The bug: this asked `spotsLeft > 0`, and a hatim's `spots` is thirty as a ceiling on
		 * `slotIndex` rather than a divisor of anything — so a group whose thirty cüz were all
		 * taken still reported twenty-eight seats free, and the filter listed groups whose own
		 * card read "Dolu · 30/30" right underneath it.
		 */
		const groups = [
			group({ isFull: true, kind: 'HATIM', name: 'full hatim', spotsLeft: 28 }),
			group({ isFull: false, kind: 'HATIM', name: 'open hatim', spotsLeft: 28 })
		];

		expect(applyGroupBrowse(groups, state({ hasSeatsOnly: true })).map(g => g.name)).toEqual(['open hatim']);
	});
});

describe('applyGroupBrowse — filtering by what is read', () => {
	it('keeps only the chosen kind, and both when none is chosen', () => {
		const groups = [group({ name: 'Cevşen' }), group({ kind: 'HATIM', name: 'Kuran' })];

		expect(applyGroupBrowse(groups, state({ kind: 'HATIM' })).map(g => g.name)).toEqual(['Kuran']);
		expect(applyGroupBrowse(groups, state()).map(g => g.name)).toHaveLength(2);
	});

	it('narrows by kind and cadence together, not as alternatives', () => {
		// The two answer different questions — *what* is read and *when* — so choosing both
		// has to mean the intersection rather than the later one replacing the earlier.
		const groups = [
			group({ cycle: 'DAILY', kind: 'HATIM', name: 'daily hatim' }),
			group({ cycle: 'WEEKLY', kind: 'HATIM', name: 'weekly hatim' }),
			group({ cycle: 'DAILY', name: 'daily cevşen' })
		];

		expect(applyGroupBrowse(groups, state({ cycle: 'DAILY', kind: 'HATIM' })).map(g => g.name)).toEqual([
			'daily hatim'
		]);
	});

	it('counts a kind filter as narrowing', () => {
		expect(isGroupBrowseNarrowed(state({ kind: 'HATIM' }))).toBe(true);
		expect(isGroupBrowseMenuActive(state({ kind: 'HATIM' }))).toBe(true);
	});
});

describe('applyGroupBrowse — filtering', () => {
	it('keeps everything when nothing is asked of it', () => {
		const groups = [group({ name: 'A' }), group({ name: 'B' })];

		expect(applyGroupBrowse(groups, state()).map(g => g.name)).toEqual(['A', 'B']);
	});

	it('narrows by cadence', () => {
		const groups = [group({ cycle: 'DAILY', name: 'D' }), group({ cycle: 'WEEKLY', name: 'W' })];

		expect(applyGroupBrowse(groups, state({ cycle: 'DAILY' })).map(g => g.name)).toEqual(['D']);
		expect(
			applyGroupBrowse([...groups, group({ cycle: 'MONTHLY', name: 'M' })], state({ cycle: 'MONTHLY' })).map(
				g => g.name
			)
		).toEqual(['M']);
	});

	it('"henüz başlamadı" keeps only gathering groups', () => {
		const groups = [group({ name: 'run', status: 'RUNNING' }), group({ name: 'wait', status: 'GATHERING' })];

		expect(applyGroupBrowse(groups, state({ isNotStartedOnly: true })).map(g => g.name)).toEqual(['wait']);
	});

	it('"boş kontenjan" drops the full ones', () => {
		const groups = [group({ name: 'full', spotsLeft: 0 }), group({ name: 'room', spotsLeft: 3 })];

		expect(applyGroupBrowse(groups, state({ hasSeatsOnly: true })).map(g => g.name)).toEqual(['room']);
	});

	it('keeps unlimited flexible groups when filtering for space to join', () => {
		const flexible = { ...group({ name: 'flexible', spotsLeft: 0 }), splitMode: 'FLEXIBLE' as const };
		expect(applyGroupBrowse([flexible], state({ hasSeatsOnly: true }))).toEqual([flexible]);
	});

	it('applies every condition together, not just the last one', () => {
		const groups = [
			group({ cycle: 'DAILY', name: 'Sabah', spotsLeft: 0, status: 'GATHERING' }),
			group({ cycle: 'DAILY', name: 'Sabah Virdi', spotsLeft: 4, status: 'GATHERING' }),
			group({ cycle: 'WEEKLY', name: 'Sabah Nuru', spotsLeft: 4, status: 'GATHERING' })
		];

		const result = applyGroupBrowse(groups, state({ cycle: 'DAILY', hasSeatsOnly: true, isNotStartedOnly: true }));

		expect(result.map(g => g.name)).toEqual(['Sabah Virdi']);
	});
});

describe('applyGroupBrowse — ordering', () => {
	it('sorts newest first by default', () => {
		const groups = [
			group({ createdAt: '2026-01-01T00:00:00.000Z', name: 'old' }),
			group({ createdAt: '2026-06-01T00:00:00.000Z', name: 'new' })
		];

		expect(applyGroupBrowse(groups, state()).map(g => g.name)).toEqual(['new', 'old']);
	});

	it('sorts by most seats free', () => {
		const groups = [group({ name: 'few', spotsLeft: 1 }), group({ name: 'many', spotsLeft: 9 })];

		expect(applyGroupBrowse(groups, state({ sortKey: 'seats' })).map(g => g.name)).toEqual(['many', 'few']);
	});

	it('"yakında başlıyor" puts gathering groups first, fullest of those leading', () => {
		// A gathering group starts when it fills, so fewest seats left is nearest to opening.
		const groups = [
			group({ name: 'running', spotsLeft: 1, status: 'RUNNING' }),
			group({ name: 'waiting-far', spotsLeft: 8, status: 'GATHERING' }),
			group({ name: 'waiting-near', spotsLeft: 1, status: 'GATHERING' })
		];

		expect(applyGroupBrowse(groups, state({ sortKey: 'soon' })).map(g => g.name)).toEqual([
			'waiting-near',
			'waiting-far',
			'running'
		]);
	});

	it('does not mutate the list it was given', () => {
		const groups = [group({ name: 'a', spotsLeft: 1 }), group({ name: 'b', spotsLeft: 9 })];

		applyGroupBrowse(groups, state({ sortKey: 'seats' }));

		expect(groups.map(g => g.name)).toEqual(['a', 'b']);
	});

	it('survives an undefined list', () => {
		expect(applyGroupBrowse(undefined, state())).toEqual([]);
	});
});

describe('isGroupBrowseNarrowed', () => {
	it('is false for the untouched state', () => {
		expect(isGroupBrowseNarrowed(emptyGroupBrowseState)).toBe(false);
	});

	it('is true for any narrowing control', () => {
		expect(isGroupBrowseNarrowed(state({ cycle: 'DAILY' }))).toBe(true);
		expect(isGroupBrowseNarrowed(state({ isNotStartedOnly: true }))).toBe(true);
		expect(isGroupBrowseNarrowed(state({ hasSeatsOnly: true }))).toBe(true);
	});

	it('is false for sorting, which reorders rather than narrows', () => {
		expect(isGroupBrowseNarrowed(state({ sortKey: 'seats' }))).toBe(false);
	});
});

describe('isGroupBrowseMenuActive', () => {
	it('is false for the untouched state', () => {
		expect(isGroupBrowseMenuActive(emptyGroupBrowseState)).toBe(false);
	});

	it('counts everything the menu sets, sort order included', () => {
		expect(isGroupBrowseMenuActive(state({ cycle: 'DAILY' }))).toBe(true);
		expect(isGroupBrowseMenuActive(state({ isNotStartedOnly: true }))).toBe(true);
		expect(isGroupBrowseMenuActive(state({ hasSeatsOnly: true }))).toBe(true);
		expect(isGroupBrowseMenuActive(state({ sortKey: 'seats' }))).toBe(true);
	});
});
