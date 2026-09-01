import type { GroupCycle, GroupStatus } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import {
	applyGroupBrowse,
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

describe('applyGroupBrowse — filtering', () => {
	it('keeps everything when nothing is asked of it', () => {
		const groups = [group({ name: 'A' }), group({ name: 'B' })];

		expect(applyGroupBrowse(groups, state()).map(g => g.name)).toEqual(['A', 'B']);
	});

	it('matches the search case-insensitively and on part of the name', () => {
		const groups = [group({ name: 'Şifa Hatmi' }), group({ name: 'Seher Hatmi' })];

		expect(applyGroupBrowse(groups, state({ search: 'seher' })).map(g => g.name)).toEqual(['Seher Hatmi']);
		expect(applyGroupBrowse(groups, state({ search: 'HATMI' })).length).toBe(2);
	});

	it('ignores surrounding whitespace in the search', () => {
		const groups = [group({ name: 'Sas' })];

		expect(applyGroupBrowse(groups, state({ search: '   ' })).length).toBe(1);
		expect(applyGroupBrowse(groups, state({ search: '  sas  ' })).length).toBe(1);
	});

	it('narrows by cadence', () => {
		const groups = [group({ cycle: 'DAILY', name: 'D' }), group({ cycle: 'WEEKLY', name: 'W' })];

		expect(applyGroupBrowse(groups, state({ cycle: 'DAILY' })).map(g => g.name)).toEqual(['D']);
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

		const result = applyGroupBrowse(
			groups,
			state({ cycle: 'DAILY', hasSeatsOnly: true, isNotStartedOnly: true, search: 'sabah' })
		);

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
		expect(isGroupBrowseNarrowed(state({ search: 'sas' }))).toBe(true);
	});

	it('is false for a blank search and for sorting, which reorder rather than narrow', () => {
		expect(isGroupBrowseNarrowed(state({ search: '   ' }))).toBe(false);
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

	// The search box is the screen's, not the menu's, and the clear leaves it alone — so a
	// search on its own must not offer a "Temizle" that would then do nothing.
	it('ignores the search term, which the clear keeps', () => {
		expect(isGroupBrowseMenuActive(state({ search: 'sas' }))).toBe(false);
	});
});
