import type { GroupSummary } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import {
	buildHomeTasks,
	homeStateFor,
	isDueToday,
	nextBoundaryAfter,
	timeLeftUntil,
	tomorrowTask,
	turkishAblativeSuffix
} from './homeTasks';

const now = new Date(2026, 8, 25, 21, 30);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString();

const group = (overrides: Partial<GroupSummary>): GroupSummary =>
	({
		id: 'g',
		name: 'Grup',
		kind: 'CEVSEN',
		cycle: 'WEEKLY',
		status: 'RUNNING',
		myBabNumbers: [21, 22, 23],
		myReadCount: 0,
		myNextBabNumber: 21,
		myShareDoneAt: null,
		mustPickCuz: false,
		myNextRoundRange: null,
		roundEndsAt: at(26, 0),
		...overrides
	} as GroupSummary);

describe('buildHomeTasks', () => {
	it('orders what is owed by deadline, soonest first', () => {
		const { pending } = buildHomeTasks(
			[
				group({ id: 'week', roundEndsAt: at(30, 0) }),
				group({ id: 'today', roundEndsAt: at(26, 0) }),
				group({ id: 'gathering', status: 'GATHERING' })
			],
			now
		);

		expect(pending.map(task => task.groupId)).toEqual(['today', 'week']);
	});

	it('names the stretch being read, or the cüz, and all of a finished share', () => {
		const { pending, readToday } = buildHomeTasks(
			[
				group({ id: 'cevsen', myBabNumbers: [21, 22, 23, 61, 62], myNextBabNumber: 22, myReadCount: 1 }),
				group({ id: 'hatim', kind: 'HATIM', myBabNumbers: [7, 22], myNextBabNumber: 7 }),
				group({ id: 'done', myBabNumbers: [61, 62, 63], myReadCount: 3, myShareDoneAt: at(25, 13, 40) })
			],
			now
		);

		expect(pending.map(task => task.range)).toEqual(['21–23', '7']);
		expect(readToday.map(task => task.range)).toEqual(['61–63']);
	});

	it('shows a hatim as one cüz plus how many more, open or finished', () => {
		const { pending, readToday } = buildHomeTasks(
			[
				group({ id: 'open', kind: 'HATIM', myBabNumbers: [4, 5, 6], myNextBabNumber: 5, myReadCount: 1 }),
				group({
					id: 'done',
					kind: 'HATIM',
					myBabNumbers: [8, 14, 15, 29, 30],
					myNextBabNumber: null,
					myReadCount: 5,
					myShareDoneAt: at(25, 12, 10)
				})
			],
			now
		);

		// Cüz 5 now, and 6 still to come — cüz 4 is already read.
		expect(pending.map(task => [task.range, task.moreCount])).toEqual([['5', 1]]);
		// A finished hatim is its first cüz and a count, never "8, 14–15, 29–30".
		expect(readToday.map(task => [task.range, task.moreCount])).toEqual([['8', 4]]);
	});

	it('drops a share whose deadline has passed — a one-off that never leaves its round', () => {
		const { pending } = buildHomeTasks(
			[group({ id: 'over', cycle: 'CUSTOM', roundEndsAt: at(24, 0) }), group({ id: 'open' })],
			now
		);

		expect(pending.map(task => task.groupId)).toEqual(['open']);
	});

	it('counts this round’s shares and how many are finished, whenever they were', () => {
		const { finishedCount, shareCount } = buildHomeTasks(
			[
				group({ id: 'monday', myReadCount: 3, myShareDoneAt: at(22, 9) }),
				group({ id: 'owing' }),
				group({ id: 'gathering', status: 'GATHERING' })
			],
			now
		);

		expect({ finishedCount, shareCount }).toEqual({ finishedCount: 1, shareCount: 2 });
	});

	it('lists only shares finished today, in the order they were finished', () => {
		const { readToday } = buildHomeTasks(
			[
				group({ id: 'evening', myReadCount: 3, myShareDoneAt: at(25, 21, 5) }),
				group({ id: 'morning', myReadCount: 3, myShareDoneAt: at(25, 7, 12) }),
				group({ id: 'monday', myReadCount: 3, myShareDoneAt: at(22, 9) })
			],
			now
		);

		expect(readToday.map(task => task.groupId)).toEqual(['morning', 'evening']);
	});
});

describe('buildHomeTasks — the audit’s cases', () => {
	it('keeps a repeating group’s share owed past its boundary until the list refetches', () => {
		// The minute ticker crosses midnight before the rolled-over list arrives; the share must
		// not vanish from Ana sayfa in between.
		const { pending } = buildHomeTasks([group({ cycle: 'DAILY', roundEndsAt: at(25, 0) })], now);

		expect(pending).toHaveLength(1);
	});

	it('turns a hatim with no cüz yet into a task to pick one, and a skipped round into nothing', () => {
		const { pending, shareCount } = buildHomeTasks(
			[
				group({ id: 'pick', kind: 'HATIM', myBabNumbers: [], myNextBabNumber: null, mustPickCuz: true }),
				group({ id: 'skipped', kind: 'HATIM', myBabNumbers: [], myNextBabNumber: null })
			],
			now
		);

		expect(pending.map(task => [task.groupId, task.mustPick])).toEqual([['pick', true]]);
		expect(shareCount).toBe(1);
	});

	it('turns a flexible group with nothing chosen, and a Hizb plan not begun, into tasks to choose', () => {
		const { pending } = buildHomeTasks(
			[
				group({ id: 'flexible', kind: 'HIZB', myBabNumbers: [], myNextBabNumber: null, splitMode: 'FLEXIBLE' }),
				group({ hizbPlan: 7, hizbToday: null, id: 'plan', kind: 'HIZB', myBabNumbers: [] })
			],
			now
		);

		expect(pending.map(task => [task.groupId, task.mustChoose])).toEqual([
			['flexible', 'flexible'],
			['plan', 'plan']
		]);
	});

	it('reads a Hizb plan day as one reading of the portions it covers, owed until it is completed', () => {
		const planGroup = (completed: boolean) =>
			group({
				hizbPlan: 7,
				hizbToday: { assignmentId: 'today-5', completed, planDays: 7, portion: 5 },
				id: 'plan',
				kind: 'HIZB',
				myBabNumbers: []
			});

		const owed = buildHomeTasks([planGroup(false)], now);
		const done = buildHomeTasks([planGroup(true)], now);

		// Named by the board's 33, as the group's card names it: the 7-day plan's fifth day is 20–22.
		expect(owed.pending.map(task => [task.range, task.nextNumber, task.mustChoose])).toEqual([['20–22', 5, null]]);
		expect(owed.pending[0]?.unitNumbers).toEqual([20, 21, 22]);
		// A plan has no board, so its owed day opens by assignment in the plan reader.
		expect(owed.pending[0]?.isPlan).toBe(true);
		expect(owed.pending[0]?.planAssignmentId).toBe('today-5');
		expect(done.pending).toHaveLength(0);
		expect(done.finishedCount).toBe(1);
	});

	it('lists a completed Hizb plan day under read today', () => {
		const { readToday } = buildHomeTasks(
			[
				group({
					hizbPlan: 7,
					hizbToday: { assignmentId: 'today-5', completed: true, planDays: 7, portion: 5 },
					id: 'plan',
					kind: 'HIZB',
					myBabNumbers: [],
					myShareDoneAt: at(25, 8, 0)
				})
			],
			now
		);

		expect(readToday.map(task => task.groupId)).toEqual(['plan']);
	});

	it('counts a daily share finished this round as read today, whatever the phone’s date', () => {
		// Finished yesterday by the phone's calendar — after the group's own midnight, in its round.
		const { readToday } = buildHomeTasks(
			[group({ cycle: 'DAILY', myReadCount: 3, myShareDoneAt: at(24, 23, 30) })],
			now
		);

		expect(readToday).toHaveLength(1);
	});

	it('counts the stretches beyond the one named, for the slice chip', () => {
		const { pending } = buildHomeTasks([group({ myBabNumbers: [21, 22, 23, 61, 62], myNextBabNumber: 21 })], now);

		expect(pending[0]).toMatchObject({ moreCount: 1, range: '21–23' });
	});
});

describe('homeStateFor', () => {
	const state = (groups: GroupSummary[]) => homeStateFor(groups.length > 0, buildHomeTasks(groups, now));

	it('names each of Ana sayfa’s states', () => {
		expect(state([])).toBe('noGroups');
		expect(state([group({})])).toBe('next');
		expect(state([group({ myReadCount: 3, myShareDoneAt: at(25, 9) })])).toBe('dayDone');
		expect(state([group({ myReadCount: 3, myShareDoneAt: at(22, 9) })])).toBe('allRead');
		expect(state([group({ status: 'GATHERING' })])).toBe('waiting');
	});
});

describe('isDueToday and nextBoundaryAfter', () => {
	it('puts a midnight deadline on the day it closes', () => {
		expect(isDueToday(at(26, 0), now)).toBe(true);
		expect(isDueToday(at(27, 0), now)).toBe(false);
	});

	it('finds the first boundary after the last fetch', () => {
		const fetchedAt = new Date(at(25, 12)).getTime();

		expect(
			nextBoundaryAfter([group({ roundEndsAt: at(28, 0) }), group({ roundEndsAt: at(26, 0) })], fetchedAt)
		).toBe(new Date(at(26, 0)).getTime());
	});
});

describe('tomorrowTask', () => {
	it('takes the group whose next round opens first, within a day', () => {
		const task = tomorrowTask(
			[
				group({
					id: 'weekly',
					name: 'Haftalık',
					roundEndsAt: at(28, 0),
					myNextRoundRange: { end: 10, start: 6 }
				}),
				group({
					id: 'daily',
					name: 'Şifa Hatmi',
					roundEndsAt: at(26, 0),
					myNextRoundRange: { end: 26, start: 24 }
				})
			],
			now
		);

		expect(task).toEqual({ groupName: 'Şifa Hatmi', kind: 'CEVSEN', range: '24–26' });
	});

	it('never offers a one-off’s next round, which does not exist', () => {
		expect(
			tomorrowTask(
				[group({ cycle: 'CUSTOM', roundEndsAt: at(26, 0), myNextRoundRange: { end: 26, start: 24 } })],
				now
			)
		).toBe(null);
	});

	it('is null when no round opens tomorrow', () => {
		expect(tomorrowTask([group({ roundEndsAt: at(28, 0), myNextRoundRange: { end: 10, start: 6 } })], now)).toBe(
			null
		);
	});
});

describe('timeLeftUntil', () => {
	it('counts hours and minutes inside a day, whole days past one', () => {
		expect(timeLeftUntil(at(26, 0), now)).toEqual({ hours: 2, minutes: 30 });
		expect(timeLeftUntil(at(1 + 30, 21, 30), now)).toEqual({ days: 6 });
	});
});

describe('turkishAblativeSuffix', () => {
	it('follows the spoken last word of the number', () => {
		expect([1, 3, 6, 9, 10, 20, 22, 30, 40, 45, 60, 70, 100].map(turkishAblativeSuffix)).toEqual([
			'den',
			'ten',
			'dan',
			'dan',
			'dan',
			'den',
			'den',
			'dan',
			'tan',
			'ten',
			'tan',
			'ten',
			'den'
		]);
	});
});
