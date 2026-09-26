import type { GroupCycle, GroupStatus } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import {
	applyGroupBrowse,
	CYCLE_FILTER_OPTIONS,
	emptyGroupBrowseState,
	isGroupBrowseMenuActive,
	isGroupBrowseNarrowed,
	type GroupBrowseState
} from './groupBrowse';

type TestGroup = {
	createdAt: string;
	cycle: GroupCycle;
	name: string;
	spotsLeft: number;
	status: GroupStatus;
};

const group = (over: Partial<TestGroup> = {}): TestGroup => ({
	createdAt: '2026-01-01T00:00:00.000Z',
	cycle: 'WEEKLY',
	name: 'Şifa Hatmi',
	spotsLeft: 2,
	status: 'RUNNING',
	...over
});

const state = (over: Partial<GroupBrowseState> = {}): GroupBrowseState => ({ ...emptyGroupBrowseState, ...over });

describe('CYCLE_FILTER_OPTIONS', () => {
	it('offers every cadence a group can have, after "all"', () => {
		expect(CYCLE_FILTER_OPTIONS).toEqual([undefined, 'DAILY', 'WEEKLY', 'MONTHLY']);
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
