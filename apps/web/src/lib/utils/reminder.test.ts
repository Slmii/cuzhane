import type { GroupSummary } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import { isNextReminderTomorrow, reminderBody, reminderTotals, type ReminderTotals } from './reminder';

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
		kind: 'CEVSEN',
		status: 'RUNNING',
		myBabNumbers: [1, 2, 3, 4, 5],
		myReadCount: 0,
		...overrides
	} as GroupSummary);

describe('reminderTotals', () => {
	it('leaves hatim groups out entirely', () => {
		/*
		 * They fell in rather than being opted in — a hatim's `myBabNumbers` is the cüz that
		 * member holds, so the arithmetic worked and the copy did not: the body names babs,
		 * and a mixed shelf summed cüz and babs into one meaningless number.
		 */
		const totals = reminderTotals([
			group({ id: 'cevsen', myBabNumbers: [1, 2, 3], myReadCount: 1 }),
			group({ id: 'hatim', kind: 'HATIM', myBabNumbers: [7, 22], myReadCount: 0 })
		]);

		expect(totals.unread).toBe(2);
		expect(totals.pendingGroups).toBe(1);
		expect(totals.participatingGroups).toBe(1);
	});

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

		expect(totals).toEqual({
			participatingGroups: 0,
			pendingGroups: 0,
			unread: 0,
			unreadBabs: 0,
			unreadPortions: 0
		});
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

describe('reminderTotals by kind', () => {
	it('counts a Cevşen group’s babs as babs', () => {
		const totals = reminderTotals([group({ myBabNumbers: [1, 2, 3], myReadCount: 1 })]);

		expect(totals).toMatchObject({ unread: 2, unreadBabs: 2, unreadPortions: 0 });
	});

	it('counts a Hizb group’s portions as portions', () => {
		const totals = reminderTotals([group({ kind: 'HIZB', myBabNumbers: [15, 16], myReadCount: 0 })]);

		expect(totals).toMatchObject({ unread: 2, unreadBabs: 0, unreadPortions: 2 });
	});

	it('keeps the two apart when both are owed', () => {
		const totals = reminderTotals([
			group({ id: 'cevsen', myBabNumbers: [1, 2, 3, 4, 5], myReadCount: 2 }),
			group({ id: 'hizb', kind: 'HIZB', myBabNumbers: [19], myReadCount: 0 })
		]);

		expect(totals).toEqual({
			participatingGroups: 2,
			pendingGroups: 2,
			unread: 4,
			unreadBabs: 3,
			unreadPortions: 1
		});
	});
});

describe('reminderBody', () => {
	const totals = (overrides: Partial<ReminderTotals>): ReminderTotals => ({
		participatingGroups: 1,
		pendingGroups: 1,
		unread: 0,
		unreadBabs: 0,
		unreadPortions: 0,
		...overrides
	});

	it('keeps the Cevşen’s own line for babs alone', () => {
		expect(reminderBody(totals({ unread: 5, unreadBabs: 5 }))).toEqual({ key: 'notifBody', values: { unread: 5 } });
	});

	it('says one bab, not "1 babs"', () => {
		expect(reminderBody(totals({ unread: 1, unreadBabs: 1 }))).toEqual({
			key: 'notifBodyOne',
			values: { unread: 1 }
		});
	});

	it('names the groups when several Cevşen groups owe babs', () => {
		expect(reminderBody(totals({ pendingGroups: 2, unread: 9, unreadBabs: 9 }))).toEqual({
			key: 'notifBodyGroups',
			values: { groups: 2, unread: 9 }
		});
	});

	it('says portions for a Hizb group, with a line for one', () => {
		expect(reminderBody(totals({ unread: 2, unreadPortions: 2 }))).toEqual({
			key: 'notifBodyPortions',
			values: { unread: 2 }
		});
		expect(reminderBody(totals({ unread: 1, unreadPortions: 1 }))).toEqual({
			key: 'notifBodyPortionsOne',
			values: { unread: 1 }
		});
	});

	it('names the groups when several Hizb groups owe portions', () => {
		expect(reminderBody(totals({ pendingGroups: 3, unread: 4, unreadPortions: 4 }))).toEqual({
			key: 'notifBodyGroupsPortions',
			values: { groups: 3, unread: 4 }
		});
	});

	it('says readings, never babs, when both are owed', () => {
		expect(reminderBody(totals({ pendingGroups: 2, unread: 4, unreadBabs: 3, unreadPortions: 1 }))).toEqual({
			key: 'notifBodyGroupsMixed',
			values: { groups: 2, unread: 4 }
		});
	});

	it('still nudges once nothing is owed', () => {
		expect(reminderBody(totals({ participatingGroups: 2 }))).toEqual({ key: 'notifBodyIdle' });
	});

	it('picks its sentence from the totals of a real shelf', () => {
		// The mixed case end to end: a Cevşen group, a Hizb group, and a finished one beside them.
		const shelf = reminderTotals([
			group({ id: 'cevsen', myBabNumbers: [1, 2, 3, 4, 5], myReadCount: 0 }),
			group({ id: 'hizb', kind: 'HIZB', myBabNumbers: [15, 16], myReadCount: 1 }),
			group({ id: 'done', kind: 'HIZB', myBabNumbers: [7], myReadCount: 1 })
		]);

		expect(reminderBody(shelf)).toEqual({ key: 'notifBodyGroupsMixed', values: { groups: 2, unread: 6 } });
	});
});

it('counts personal Hizb assignments without treating inactive readers as owing work', () => {
	const pending = group({
		kind: 'HIZB',
		hizbPlan: 7,
		myBabNumbers: [],
		hizbToday: { assignmentId: 'a', planDays: 7, portion: 2, completed: false }
	});
	const complete = group({ ...pending, hizbToday: { assignmentId: 'a', planDays: 7, portion: 2, completed: true } });
	const removed = group({ ...pending, hizbToday: null });
	expect(reminderTotals([pending, complete, removed])).toEqual({
		participatingGroups: 2,
		pendingGroups: 1,
		unread: 1,
		unreadBabs: 0,
		unreadPortions: 1
	});
});
