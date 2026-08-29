import type { GroupSummary } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import { isNextReminderTomorrow, reminderTotals } from './reminder';

const at = (hour: number, minute: number, second = 0) => new Date(2026, 7, 29, hour, minute, second);

describe('isNextReminderTomorrow', () => {
	it('keeps a time still ahead today on today', () => {
		expect(isNextReminderTomorrow('21:30', at(9, 29))).toBe(false);
	});

	it('moves a time already past to tomorrow', () => {
		expect(isNextReminderTomorrow('09:29', at(9, 30))).toBe(true);
	});

	it('treats the current minute as tomorrow', () => {
		// The real failure this label exists for: 09:29 chosen at 09:29 reached the OS at
		// 09:29:02, and a repeating trigger matches the next date strictly after now.
		expect(isNextReminderTomorrow('09:29', at(9, 29, 2))).toBe(true);
	});

	it('is minute-accurate within the same hour', () => {
		expect(isNextReminderTomorrow('09:30', at(9, 29, 59))).toBe(false);
	});
});

const group = (overrides: Partial<GroupSummary>): GroupSummary =>
	({
		id: 'g',
		status: 'RUNNING',
		myBabNumbers: [1, 2, 3, 4, 5],
		myReadCount: 0,
		...overrides
	} as GroupSummary);

describe('reminderTotals', () => {
	it('sums what is still owed across every running group', () => {
		const totals = reminderTotals([
			group({ id: 'a', myBabNumbers: [1, 2, 3], myReadCount: 1 }),
			group({ id: 'b', myBabNumbers: [4, 5], myReadCount: 0 })
		]);

		expect(totals.unread).toBe(4);
		expect(totals.pendingGroups).toBe(2);
		expect(totals.participatingGroups).toBe(2);
	});

	it('counts a finished group as participating but not pending', () => {
		// The distinction the notification copy rests on: six groups on the shelf and one still
		// owing should read as one group's worth, not six.
		const totals = reminderTotals([
			group({ id: 'done', myBabNumbers: [1, 2], myReadCount: 2 }),
			group({ id: 'owing', myBabNumbers: [3, 4], myReadCount: 1 })
		]);

		expect(totals.unread).toBe(1);
		expect(totals.pendingGroups).toBe(1);
		expect(totals.participatingGroups).toBe(2);
	});

	it('ignores groups that have not started and ones with no share today', () => {
		const totals = reminderTotals([
			group({ id: 'gathering', status: 'GATHERING' }),
			group({ id: 'noShare', myBabNumbers: [] })
		]);

		expect(totals).toEqual({ participatingGroups: 0, pendingGroups: 0, unread: 0 });
	});

	it('never reports negative work when more is read than the share holds', () => {
		// `myReadCount` counts reads by anyone in the share, so a rotation handing over a
		// part-read block must not produce a negative total.
		const totals = reminderTotals([group({ myBabNumbers: [1, 2], myReadCount: 5 })]);

		expect(totals.unread).toBe(0);
		expect(totals.pendingGroups).toBe(0);
	});

	it('treats no groups at all as nothing to say', () => {
		expect(reminderTotals(undefined).participatingGroups).toBe(0);
	});
});
