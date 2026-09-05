import { describe, expect, it } from 'vitest';
import { weekStrip } from './weekStrip';

/** Thursday 3 September 2026, local noon — mid-week, so both halves of the strip are exercised. */
const thursday = new Date(2026, 8, 3, 12);

describe('weekStrip', () => {
	it('runs Monday to Sunday around the given day', () => {
		const week = weekStrip([], thursday);

		expect(week).toHaveLength(7);
		expect(week[0]?.key).toBe('2026-08-31');
		expect(week[6]?.key).toBe('2026-09-06');
		expect(week.map(day => day.weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	it('marks today once, and only the days after it as future', () => {
		const week = weekStrip([], thursday);

		expect(week.filter(day => day.isToday).map(day => day.key)).toEqual(['2026-09-03']);
		expect(week.filter(day => day.isFuture).map(day => day.key)).toEqual([
			'2026-09-04',
			'2026-09-05',
			'2026-09-06'
		]);
	});

	it('reads a day off the counts, and a zero count is not a read day', () => {
		const week = weekStrip(
			[
				{ count: 4, date: '2026-08-31' },
				{ count: 0, date: '2026-09-01' }
			],
			thursday
		);

		expect(week.map(day => day.hasRead)).toEqual([true, false, false, false, false, false, false]);
	});

	it('keeps the reader’s own calendar day rather than the UTC one', () => {
		// 22:30 local on the 2nd is already the 3rd in UTC east of Greenwich; the key must not slide.
		const lateEvening = new Date(2026, 8, 2, 22, 30);

		expect(
			weekStrip([], lateEvening)
				.filter(day => day.isToday)
				.map(day => day.key)
		).toEqual(['2026-09-02']);
	});
});
