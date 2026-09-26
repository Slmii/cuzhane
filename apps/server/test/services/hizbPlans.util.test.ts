import { describe, expect, it } from 'vitest';
import { coverageFor, portionForDay, spansFor, PLAN_DAYS } from '@utils/hizbPlans';

describe('personal Hizb rotations', () => {
	it('each starting position covers the whole plan exactly once and wraps', () => {
		for (const days of PLAN_DAYS) {
			for (let sequence = 0; sequence < days * 3; sequence++) {
				const portions = Array.from({ length: days }, (_, day) => portionForDay(days, sequence, day));
				expect(new Set(portions).size).toBe(days);
				expect(portionForDay(days, sequence, days)).toBe(portions[0]);
			}
		}
	});
	it('all plan divisions cover exactly the same canonical spans', () => {
		const totals = PLAN_DAYS.map(days => Array.from({ length: days }, (_, i) => spansFor(days, i + 1)).flat());
		expect(totals[0]).toEqual(totals[1]);
		expect(totals[1]).toEqual(totals[2]);
		expect(new Set(totals[0]).size).toBe(totals[0]!.length);
	});
	it('duplicates and mixed-plan overlaps cannot hide a missing passage', () => {
		const reads = Array.from({ length: 40 }, () => ({ planDays: 7, portion: 1 }));
		expect(coverageFor(reads).complete).toBe(false);
		expect(coverageFor(reads).covered).toBe(spansFor(7, 1).length);
		expect(coverageFor(Array.from({ length: 7 }, (_, i) => ({ planDays: 7, portion: i + 1 }))).complete).toBe(true);
	});
});
