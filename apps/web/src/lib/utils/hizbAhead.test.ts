import { describe, expect, it } from 'vitest';
import { canUndoHizbDay, civilDaysBetween, hizbAheadView, isReadBeforeItsDay } from './hizbAhead';

const TODAY = '2026-10-02';
const read = { completedAt: '2026-10-02T06:00:00.000Z' };
const unread = { completedAt: null };
const tomorrow = { assignmentId: null, date: '2026-10-03', day: 41, portion: 9 };

describe('civilDaysBetween', () => {
	it('counts whole days, across a month and a year', () => {
		expect(civilDaysBetween(TODAY, '2026-10-03')).toBe(1);
		expect(civilDaysBetween('2026-09-30', '2026-10-02')).toBe(2);
		expect(civilDaysBetween('2026-12-31', '2027-01-01')).toBe(1);
		expect(civilDaysBetween(TODAY, TODAY)).toBe(0);
	});

	it('is not thrown by a clock change in between', () => {
		// Europe's clocks go back on 25 October 2026; civil dates know nothing of it.
		expect(civilDaysBetween('2026-10-24', '2026-10-26')).toBe(2);
	});
});

describe('hizbAheadView', () => {
	it('offers nothing ahead and keeps today’s undo off while today is unread', () => {
		const view = hizbAheadView({ ahead: tomorrow, aheadThrough: null, date: TODAY, today: unread });

		expect(view.offer).toBeNull();
		expect(view.canUndoToday).toBe(false);
	});

	it('offers the next day once today is read, with today’s undo while nothing ahead is read', () => {
		const view = hizbAheadView({ ahead: tomorrow, aheadThrough: null, date: TODAY, today: read });

		expect(view.offer).toEqual({ ...tomorrow, daysAway: 1 });
		expect(view.through).toBeNull();
		expect(view.canUndoToday).toBe(true);
	});

	it('says how far ahead with no undo, and names the day after it further out', () => {
		const view = hizbAheadView({
			ahead: { assignmentId: 'a-5', date: '2026-10-05', day: 43, portion: 11 },
			aheadThrough: { date: '2026-10-04', days: 2 },
			date: TODAY,
			today: read
		});

		expect(view.offer?.daysAway).toBe(3);
		expect(view.through?.days).toBe(2);
		expect(view.canUndoToday).toBe(false);
	});

	it('treats an older server’s missing fields as nothing ahead', () => {
		const view = hizbAheadView({ date: TODAY, today: read });

		expect(view.offer).toBeNull();
		expect(view.through).toBeNull();
		expect(view.canUndoToday).toBe(true);
	});

	it('offers nothing with no reading today', () => {
		expect(hizbAheadView({ ahead: tomorrow, date: TODAY, today: null }).offer).toBeNull();
	});
});

describe('canUndoHizbDay', () => {
	const state = { aheadThrough: { date: '2026-10-04', days: 2 }, date: TODAY };

	it('never undoes a day read ahead, nor today while a day ahead is read', () => {
		expect(canUndoHizbDay('2026-10-04', state)).toBe(false);
		expect(canUndoHizbDay('2026-10-03', state)).toBe(false);
		expect(canUndoHizbDay(TODAY, state)).toBe(false);
	});

	it('leaves a missed day caught up free to undo', () => {
		expect(canUndoHizbDay('2026-09-28', state)).toBe(true);
	});

	it('undoes today with nothing read ahead, and leaves it to the server with no state at hand', () => {
		expect(canUndoHizbDay(TODAY, { aheadThrough: null, date: TODAY })).toBe(true);
		expect(canUndoHizbDay(TODAY, { date: TODAY })).toBe(true);
		expect(canUndoHizbDay(TODAY, undefined)).toBe(true);
	});
});

describe('isReadBeforeItsDay', () => {
	it('is true for a day read on an earlier day, in the group’s zone', () => {
		expect(isReadBeforeItsDay('2026-10-01T18:00:00.000Z', TODAY, 'Europe/Istanbul')).toBe(true);
	});

	it('is false for a day read on its own day', () => {
		expect(isReadBeforeItsDay('2026-10-02T06:00:00.000Z', TODAY, 'Europe/Istanbul')).toBe(false);
	});

	it('goes by the group’s midnight, not UTC’s', () => {
		// 22:30 UTC on the 1st is already 01:30 on the 2nd in Istanbul.
		expect(isReadBeforeItsDay('2026-10-01T22:30:00.000Z', TODAY, 'Europe/Istanbul')).toBe(false);
		expect(isReadBeforeItsDay('2026-10-01T22:30:00.000Z', TODAY, 'UTC')).toBe(true);
	});

	it('is false for a day not read', () => {
		expect(isReadBeforeItsDay(null, TODAY, 'Europe/Istanbul')).toBe(false);
	});
});
