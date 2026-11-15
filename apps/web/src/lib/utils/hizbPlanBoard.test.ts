import { describe, expect, it } from 'vitest';
import { boardPortionsOf, planBoardCells, unreadPortionCount } from './hizbPlanBoard';
import { spansFor } from './hizbPlans';

describe('planBoardCells', () => {
	it('draws all 32 unread with nothing covered, and rings today’s portion', () => {
		const cells = planBoardCells([], { planDays: 32, portion: 8 });

		expect(cells).toHaveLength(32);
		expect(cells.every(cell => cell.state === 'unread')).toBe(true);
		expect(cells.filter(cell => cell.isMine).map(cell => cell.number)).toEqual([8]);
	});

	it('marks a portion read only when every span of it is covered', () => {
		const spans = spansFor(32, 5);
		const cells = planBoardCells(spans, null);

		expect(cells.filter(cell => cell.state === 'read').map(cell => cell.number)).toEqual([5]);
		expect(unreadPortionCount(spans)).toBe(31);
	});

	it('fills every portion a longer plan’s day covers', () => {
		const week = spansFor(7, 1);
		const read = planBoardCells(week, { planDays: 7, portion: 1 }).filter(cell => cell.state === 'read');

		expect(read.length).toBeGreaterThan(1);
		expect(read.every(cell => cell.isMine)).toBe(true);
	});
});

describe('boardPortionsOf', () => {
	it('is the portion itself on a 32-day plan, and several on a 7-day one', () => {
		expect(boardPortionsOf(32, 14)).toEqual([14]);
		expect(boardPortionsOf(7, 3).length).toBeGreaterThan(1);
	});
});
