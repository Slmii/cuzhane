import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { createGroupForUser, getGroupDetailForUser } from '@services/groups.service';
import { joinGroupForUser, leaveGroupForUser, removeMemberForUser } from '@services/groupMembership.service';
import { enrollHizb, getHizbState, openHizbAhead, updateHizbAssignment } from '@services/hizbReading.service';
import { notifyHizbRead } from '@services/hizbReadNotice.service';
import { getProfileStatsForUser } from '@services/profile.service';
import { spansFor } from '@utils/hizbPlans';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
// Asserted on: a day read ahead is never announced to the group.
vi.mock('@services/hizbReadNotice.service', () => ({ notifyHizbRead: vi.fn(async () => undefined) }));
assertIsTestDatabase(testDatabaseUrl());

const start = new Date('2026-10-01T10:00:00Z');
const ZONE = 'Europe/Amsterdam';
const day = (n: number) => new Date(start.getTime() + n * 86400000);
/** The group-local civil date of a day number, as the state carries it. */
const dateOf = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const ascending = (spans: readonly number[]) => [...spans].sort((a, b) => a - b);

const create = async (plan = 7, inactivityDays: number | null = null) => {
	vi.setSystemTime(start);
	return createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Reading ahead',
			kind: 'HIZB',
			hizbPlan: plan,
			inactivityDays,
			visibility: 'PRIVATE',
			cycle: 'DAILY',
			reminderTime: '21:00',
			timezone: ZONE
		})
	);
};

const createIndividual = async () => {
	vi.setSystemTime(start);
	return createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'My outside group',
			kind: 'HIZB',
			hizbPlan: 7,
			hizbIndividual: true,
			hizbStartPortion: 6,
			reminderTime: '21:00',
			timezone: ZONE
		})
	);
};

/** Marks a day read from the book — every portion ticked, so no counter gates it. */
const read = (userId: string, groupId: string, a: { id: string; version: number; boardPortions: number[] }) =>
	updateHizbAssignment(userId, groupId, a.id, { version: a.version, bookPortions: a.boardPortions });

const undo = (userId: string, groupId: string, a: { id: string; version: number }) =>
	updateHizbAssignment(userId, groupId, a.id, { version: a.version, read: false });

const lastReadDayOf = async (groupId: string, userId = 'owner') =>
	(await prisma.hizbEnrollment.findFirstOrThrow({ where: { groupId, userId, endDay: null } })).lastReadDay;

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe('reading ahead', () => {
	it('offers the next day once today is read, and opens the same row until it is read', async () => {
		const group = await create();
		const first = await getHizbState('owner', group.id);
		const today = first.today!;
		expect(today.date).toBe(dateOf(today.day));
		expect(first.ahead).toBeNull();
		expect(first.aheadThrough).toBeNull();

		await read('owner', group.id, today);
		const offered = await getHizbState('owner', group.id);
		expect(offered.ahead).toEqual({
			day: today.day + 1,
			date: dateOf(today.day + 1),
			portion: 2,
			assignmentId: null
		});
		expect(offered.aheadThrough).toBeNull();

		const next = await openHizbAhead('owner', group.id);
		expect(next).toMatchObject({
			day: today.day + 1,
			date: dateOf(today.day + 1),
			portion: 2,
			traversal: 0,
			round: 1,
			version: 0,
			completedAt: null
		});
		// Serialized as today's reading is.
		expect(Object.keys(next).sort()).toEqual(Object.keys(today).sort());
		expect((await openHizbAhead('owner', group.id)).id).toBe(next.id);
		// Opened early without moving how far the plan is made.
		const enrollment = await prisma.hizbEnrollment.findFirstOrThrow({ where: { groupId: group.id } });
		expect(enrollment.generatedThrough).toBe(today.day);

		const opened = await getHizbState('owner', group.id);
		expect(opened.ahead?.assignmentId).toBe(next.id);
		expect(opened.today?.id).toBe(today.id);
		expect(opened.assignments.map(a => a.id)).not.toContain(next.id);

		const readNext = await read('owner', group.id, next);
		const after = await getHizbState('owner', group.id);
		expect(after.ahead).toEqual({
			day: today.day + 2,
			date: dateOf(today.day + 2),
			portion: 3,
			assignmentId: null
		});
		expect(after.aheadThrough).toEqual({
			days: 1,
			date: next.date,
			readings: [{ day: next.day, date: next.date, portion: 2, completedAt: readNext.completedAt }]
		});
		// Today's board and round hold today's reading only, until the next day comes.
		expect(ascending(after.coveredSpans)).toEqual(ascending(spansFor(7, 1)));
		expect(after.currentRound).toEqual({ number: 1, read: 1, days: 1 });
		expect(after.members.find(m => m.isMe)?.completed).toBe(true);
		expect(await openHizbAhead('owner', group.id)).toMatchObject({ day: today.day + 2, portion: 3 });

		// The last day read is undone, the day opened after it unread.
		await undo('owner', group.id, readNext);
		const undone = await getHizbState('owner', group.id);
		expect(undone.aheadThrough).toBeNull();
		expect(undone.ahead).toEqual({ day: next.day, date: next.date, portion: 2, assignmentId: next.id });
	});

	it('reads ahead with no limit, into the next round, counting a round only once its days come', async () => {
		const group = await create();
		const today = (await getHizbState('owner', group.id)).today!;
		await read('owner', group.id, today);
		for (let i = 1; i <= 8; i++) {
			const next = await openHizbAhead('owner', group.id);
			expect(next.day).toBe(today.day + i);
			await read('owner', group.id, next);
		}
		const state = await getHizbState('owner', group.id);
		expect(state.aheadThrough).toMatchObject({ days: 8, date: dateOf(today.day + 8) });
		// The list behind it: every day read ahead, in order, with its own portion.
		expect(state.aheadThrough?.readings.map(r => [r.day, r.date, r.portion])).toEqual(
			Array.from({ length: 8 }, (_, i) => [today.day + i + 1, dateOf(today.day + i + 1), ((i + 1) % 7) + 1])
		);
		expect(state.ahead).toMatchObject({ day: today.day + 9, portion: 3 });
		const wrapped = await prisma.hizbAssignment.findFirstOrThrow({ where: { day: today.day + 7 } });
		expect(wrapped).toMatchObject({ portion: 1, traversal: 1 });
		expect(state.completedTraversals).toBe(0);

		vi.setSystemTime(day(7));
		const later = await getHizbState('owner', group.id);
		expect(later.today).toMatchObject({ id: wrapped.id, round: 2 });
		expect(later.today?.completedAt).not.toBeNull();
		expect(later.completedTraversals).toBe(1);
		expect(later.missedCount).toBe(0);
		expect(later.aheadThrough).toMatchObject({ days: 1, date: dateOf(today.day + 8) });
		expect(later.aheadThrough?.readings.map(r => r.day)).toEqual([today.day + 8]);
	});

	it('refuses an outsider, a member with no plan running and an old shared board', async () => {
		const group = await create();
		await expect(openHizbAhead('outsider', group.id)).rejects.toMatchObject({ statusCode: 403 });
		// Today not read yet.
		await expect(openHizbAhead('owner', group.id)).rejects.toMatchObject({ statusCode: 409 });

		// A members-choose group, before choosing a plan.
		const choosing = await create(0);
		await expect(openHizbAhead('owner', choosing.id)).rejects.toMatchObject({ statusCode: 404 });

		// Taken out of the order for inactivity.
		const idle = await create(7, 1);
		vi.setSystemTime(day(1));
		expect((await getHizbState('owner', idle.id)).enrollment?.reason).toBe('INACTIVITY');
		await expect(openHizbAhead('owner', idle.id)).rejects.toMatchObject({ statusCode: 404 });

		const board = await create();
		await prisma.group.update({ where: { id: board.id }, data: { hizbPlan: null } });
		await expect(openHizbAhead('owner', board.id)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('is not held back by missed days, and a caught-up day does not shorten the run', async () => {
		const group = await create();
		vi.setSystemTime(day(2));
		const state = await getHizbState('owner', group.id);
		expect(state.missedCount).toBe(2);
		await read('owner', group.id, state.today!);
		const next = await read('owner', group.id, await openHizbAhead('owner', group.id));
		expect(next.day).toBe(state.today!.day + 1);
		expect(await lastReadDayOf(group.id)).toBe(next.day);

		const missed = state.missed[0]!;
		const caughtUp = await read('owner', group.id, missed);
		expect(await lastReadDayOf(group.id)).toBe(next.day);
		// A past day is undone freely, read-ahead days after it or not.
		await undo('owner', group.id, caughtUp);
		expect(await lastReadDayOf(group.id)).toBe(next.day);
		const after = await getHizbState('owner', group.id);
		expect(after.missedCount).toBe(2);
		expect(after.aheadThrough).toMatchObject({ days: 1, date: next.date });
	});
});

describe('order', () => {
	it('takes a later day only in order, and undoes days only from the end', async () => {
		const group = await create();
		const today = await read('owner', group.id, (await getHizbState('owner', group.id)).today!);
		let first = await read('owner', group.id, await openHizbAhead('owner', group.id));
		const second = await openHizbAhead('owner', group.id);
		// Next in line: its progress is kept.
		const marked = await updateHizbAssignment('owner', group.id, second.id, { version: 0, bookmark: 3 });
		expect(marked.bookmark).toBe(3);

		await expect(undo('owner', group.id, today)).rejects.toMatchObject({ statusCode: 409 });
		first = await undo('owner', group.id, first);
		expect(first.completedAt).toBeNull();

		// The day after an unread one is out of order: neither its progress nor its reading is taken.
		await expect(
			updateHizbAssignment('owner', group.id, second.id, { version: marked.version, bookmark: 4 })
		).rejects.toMatchObject({ statusCode: 409, message: 'This reading is in the future' });
		await expect(read('owner', group.id, marked)).rejects.toMatchObject({ statusCode: 409 });
		const back = await getHizbState('owner', group.id);
		expect(back.ahead).toMatchObject({ day: first.day, assignmentId: first.id });
		expect(back.aheadThrough).toBeNull();

		first = await read('owner', group.id, first);
		const done = await read('owner', group.id, marked);
		await expect(undo('owner', group.id, first)).rejects.toMatchObject({ statusCode: 409 });
		await expect(undo('owner', group.id, today)).rejects.toMatchObject({ statusCode: 409 });
		await undo('owner', group.id, done);
		await undo('owner', group.id, first);
		await undo('owner', group.id, today);

		// Today unread again: nothing after it is taken, nor offered.
		const opened = await prisma.hizbAssignment.findUniqueOrThrow({ where: { id: first.id } });
		await expect(read('owner', group.id, { ...opened, boardPortions: first.boardPortions })).rejects.toMatchObject({
			statusCode: 409
		});
		await expect(openHizbAhead('owner', group.id)).rejects.toMatchObject({ statusCode: 409 });
		const state = await getHizbState('owner', group.id);
		expect(state.ahead).toBeNull();
		expect(state.aheadThrough).toBeNull();
	});

	it('refuses any change to an unread day that is no longer next, an undo included', async () => {
		const group = await create();
		await read('owner', group.id, (await getHizbState('owner', group.id)).today!);
		const first = await read('owner', group.id, await openHizbAhead('owner', group.id));
		const second = await openHizbAhead('owner', group.id);
		await undo('owner', group.id, first);
		const patches = [
			{ version: 0, read: false, bookmark: 1 },
			{ version: 0, read: false, repetitions: 1 },
			{ version: 0, bookmark: 1 },
			{ version: 0, repetitions: 1 },
			{ version: 0, bookPortions: [second.boardPortions[0]!] }
		];
		for (const patch of patches) {
			await expect(updateHizbAssignment('owner', group.id, second.id, patch)).rejects.toMatchObject({
				statusCode: 409,
				message: 'This reading is in the future'
			});
		}
		expect(await prisma.hizbAssignment.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
			version: 0,
			bookmark: 0,
			readPortions: []
		});
	});

	it('opens one row for two taps at once', async () => {
		const group = await create();
		const today = (await getHizbState('owner', group.id)).today!;
		await read('owner', group.id, today);
		const [a, b] = await Promise.all([openHizbAhead('owner', group.id), openHizbAhead('owner', group.id)]);
		expect(a.id).toBe(b.id);
		expect(await prisma.hizbAssignment.count({ where: { day: today.day + 1 } })).toBe(1);
	});
});

describe('when the day comes', () => {
	it('announces a day opened early but read on its own day', async () => {
		const group = await create();
		await read('owner', group.id, (await getHizbState('owner', group.id)).today!);
		const opened = await openHizbAhead('owner', group.id);
		expect(notifyHizbRead).toHaveBeenCalledTimes(1);
		vi.setSystemTime(day(1));
		await read('owner', group.id, opened);
		expect(notifyHizbRead).toHaveBeenCalledTimes(2);
	});

	it('counts a day read ahead as read on its own day, and never tells the group', async () => {
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		const today = (await getHizbState('reader', group.id)).today!;
		await read('reader', group.id, today);
		// Today's own reading is announced — the notice is wired.
		expect(notifyHizbRead).toHaveBeenCalledTimes(1);
		const ahead = await read('reader', group.id, await openHizbAhead('reader', group.id));
		expect(notifyHizbRead).toHaveBeenCalledTimes(1);
		// Not on today's board: the reader's own portion only.
		expect(ascending((await getHizbState('owner', group.id)).coveredSpans)).toEqual(
			ascending(spansFor(7, today.portion))
		);

		vi.setSystemTime(day(1));
		const arrived = await getHizbState('reader', group.id);
		expect(arrived.today).toMatchObject({ id: ahead.id, completedAt: ahead.completedAt });
		expect(arrived.missedCount).toBe(0);
		expect(arrived.currentRound).toEqual({ number: 1, read: 2, days: 2 });
		expect(arrived.members.find(m => m.isMe)?.completed).toBe(true);
		expect(ascending(arrived.coveredSpans)).toEqual(ascending(spansFor(7, ahead.portion)));
		expect(arrived.aheadThrough).toBeNull();
		expect(arrived.ahead).toEqual({
			day: ahead.day + 1,
			date: dateOf(ahead.day + 1),
			portion: ahead.portion + 1,
			assignmentId: null
		});
		expect(arrived.assignments.map(a => a.id)).toContain(today.id);
		// Home's card: today done, from the row read ahead.
		expect((await getGroupDetailForUser('reader', group.id)).hizbToday).toMatchObject({
			completed: true,
			assignmentId: ahead.id
		});
		// Kept on its day, not made again.
		expect(
			await prisma.hizbAssignment.count({ where: { enrollment: { groupId: group.id, userId: 'reader' } } })
		).toBe(2);
		// Opened on its day, it is still not news.
		await updateHizbAssignment('reader', group.id, ahead.id, { version: ahead.version, bookmark: 2 });
		expect(notifyHizbRead).toHaveBeenCalledTimes(1);
		expect(
			(await prisma.hizbAssignment.findUniqueOrThrow({ where: { id: ahead.id } })).readNoticeSentAt
		).toBeNull();
	});

	it('keeps counting the profile streak by the days actually read', async () => {
		const group = await create();
		await read('owner', group.id, (await getHizbState('owner', group.id)).today!);
		for (let i = 0; i < 3; i++) {
			await read('owner', group.id, await openHizbAhead('owner', group.id));
		}
		expect((await getProfileStatsForUser('owner', ZONE)).streakDays).toBe(1);
		vi.setSystemTime(day(2));
		expect((await getProfileStatsForUser('owner', ZONE)).streakDays).toBe(0);
	});
});

describe('inactivity', () => {
	it('keeps the plan running through the furthest day read, and moves it back on an undo', async () => {
		const group = await create(7, 3);
		const today = (await getHizbState('owner', group.id)).today!;
		await read('owner', group.id, today);
		let last = await read('owner', group.id, await openHizbAhead('owner', group.id));
		for (let i = 2; i <= 4; i++) {
			last = await read('owner', group.id, await openHizbAhead('owner', group.id));
		}
		expect(await lastReadDayOf(group.id)).toBe(today.day + 4);
		// Undone from the end: active through the furthest day still read, not back to today.
		await undo('owner', group.id, last);
		expect(await lastReadDayOf(group.id)).toBe(today.day + 3);
		// Three idle days after day 3.
		vi.setSystemTime(day(6));
		expect((await getHizbState('owner', group.id)).enrollment?.endDay).toBeNull();
		vi.setSystemTime(day(7));
		expect((await getHizbState('owner', group.id)).enrollment?.reason).toBe('INACTIVITY');
	});

	it('drops a day opened ahead and never read when the plan ends for inactivity', async () => {
		const group = await create(7, 1);
		const opened = (await getHizbState('owner', group.id)).today!;
		const today = await read('owner', group.id, opened);
		const first = await read('owner', group.id, await openHizbAhead('owner', group.id));
		const second = await openHizbAhead('owner', group.id);
		await undo('owner', group.id, first);
		await undo('owner', group.id, today);
		expect(await lastReadDayOf(group.id)).toBeNull();

		vi.setSystemTime(day(1));
		expect((await getHizbState('owner', group.id)).enrollment?.reason).toBe('INACTIVITY');
		expect(await prisma.hizbAssignment.findUnique({ where: { id: second.id } })).toBeNull();
		// The day the plan ended on stays as catch-up, as any day opened before a removal does.
		expect(await prisma.hizbAssignment.findUnique({ where: { id: first.id } })).not.toBeNull();
		vi.setSystemTime(day(3));
		expect((await getHizbState('owner', group.id)).missed.map(a => a.day)).not.toContain(second.day);
	});
});

describe('leaving and changing plan', () => {
	it('drops the days read ahead when the member leaves, and starts afresh on a new plan', async () => {
		const group = await create(0);
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		await enrollHizb('reader', group.id, 7);
		const today = (await getHizbState('reader', group.id)).today!;
		await read('reader', group.id, today);
		await read('reader', group.id, await openHizbAhead('reader', group.id));
		await openHizbAhead('reader', group.id);

		await leaveGroupForUser('reader', group.id);
		const kept = await prisma.hizbAssignment.findMany({
			where: { enrollment: { groupId: group.id, userId: 'reader' } }
		});
		expect(kept.map(a => a.day)).toEqual([today.day]);
		expect(kept[0]?.completedAt).not.toBeNull();

		await joinGroupForUser('reader', 'Reader', group.id);
		await enrollHizb('reader', group.id, 15);
		const back = await getHizbState('reader', group.id);
		expect(back.enrollment?.planDays).toBe(15);
		expect(back.ahead).toBeNull();
		expect(back.aheadThrough).toBeNull();
		await read('reader', group.id, back.today!);
		expect(await openHizbAhead('reader', group.id)).toMatchObject({ day: today.day + 1, planDays: 15 });
	});

	it('drops the days read ahead when the owner removes the member', async () => {
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		const today = (await getHizbState('reader', group.id)).today!;
		await read('reader', group.id, today);
		await read('reader', group.id, await openHizbAhead('reader', group.id));
		await openHizbAhead('reader', group.id);

		await removeMemberForUser('owner', group.id, 'reader');
		const kept = await prisma.hizbAssignment.findMany({
			where: { enrollment: { groupId: group.id, userId: 'reader' } }
		});
		expect(kept.map(a => a.day)).toEqual([today.day]);
	});
});

describe('individual reading', () => {
	it('reads ahead the same way, wrapping the plan, with no notice', async () => {
		const group = await createIndividual();
		const today = (await getHizbState('owner', group.id)).today!;
		expect(today.portion).toBe(6);
		await read('owner', group.id, today);
		const next = await read('owner', group.id, await openHizbAhead('owner', group.id));
		expect(next.portion).toBe(7);
		const wrap = await openHizbAhead('owner', group.id);
		expect(wrap).toMatchObject({ day: today.day + 2, portion: 1, round: 1 });
		const state = await getHizbState('owner', group.id);
		expect(state.ahead).toEqual({ day: wrap.day, date: wrap.date, portion: 1, assignmentId: wrap.id });
		expect(state.aheadThrough).toMatchObject({ days: 1, date: next.date });
		expect(notifyHizbRead).not.toHaveBeenCalled();

		vi.setSystemTime(day(1));
		const detail = await getGroupDetailForUser('owner', group.id);
		expect(detail.percent).toBe(100);
		expect(detail.hizbToday).toMatchObject({ portion: 7, completed: true, assignmentId: next.id });
		expect((await getHizbState('owner', group.id)).missedCount).toBe(0);
	});
});
