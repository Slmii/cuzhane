import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { createGroupForUser, updateGroupForUser } from '@services/groups.service';
import { joinGroupForUser, leaveGroupForUser } from '@services/groupMembership.service';
import {
	getHizbHistoryDay,
	getHizbHistoryDays,
	getHizbState,
	updateHizbAssignment
} from '@services/hizbReading.service';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: vi.fn(async () => 0) }));
assertIsTestDatabase(testDatabaseUrl());

const start = new Date('2026-10-01T10:00:00Z');
const MEMBERS = ['m1', 'm2', 'm3'];
const DAY_MS = 86400000;

/** Moves the clock `n` days past the group's first day, same hour. */
const goToDay = (n: number) => vi.setSystemTime(new Date(start.getTime() + n * DAY_MS));

/** A shared seven-day plan with three members besides the owner. */
const createPlan = async (members = MEMBERS) => {
	goToDay(0);
	const group = await createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Vakıf',
			kind: 'HIZB',
			hizbPlan: 7,
			visibility: 'OPEN',
			cycle: 'DAILY',
			reminderTime: '21:00',
			timezone: 'Europe/Amsterdam'
		})
	);
	for (const member of members) {
		await joinGroupForUser(member, member.toUpperCase(), group.id);
	}
	return group;
};

/** Marks the member's day read from the book — every portion ticked, so no counter gates it. */
const readToday = async (userId: string, groupId: string) => {
	const today = (await getHizbState(userId, groupId)).today!;
	return updateHizbAssignment(userId, groupId, today.id, {
		version: today.version,
		bookPortions: today.boardPortions
	});
};

const todayOf = async (groupId: string) => (await getHizbHistoryDays('owner', groupId)).days[0]!.day;

const rowOf = (day: Awaited<ReturnType<typeof getHizbHistoryDay>>, name: string) =>
	day.members.find(m => m.displayName === name || (name === 'me' && m.isMe));

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe('the group history, day by day', () => {
	it('lists the days newest first, counting everyone who owed a reading — opened the app or not', async () => {
		const group = await createPlan();
		await readToday('m1', group.id);
		goToDay(1);
		await readToday('m1', group.id);
		await readToday('m2', group.id);

		const { days, nextBefore } = await getHizbHistoryDays('m3', group.id);

		expect(days.map(d => [d.isToday, d.read, d.readers])).toEqual([
			[true, 2, 4],
			[false, 1, 4]
		]);
		expect(days[0]!.day - days[1]!.day).toBe(1);
		expect(nextBefore).toBeNull();
	});

	it('pages thirty days at a time', async () => {
		const group = await createPlan([]);
		goToDay(44);

		const first = await getHizbHistoryDays('owner', group.id);
		expect(first.days).toHaveLength(30);
		expect(first.nextBefore).toBe(first.days[29]!.day);

		const second = await getHizbHistoryDays('owner', group.id, first.nextBefore!);
		expect(second.days).toHaveLength(15);
		expect(second.days[0]!.day).toBe(first.nextBefore! - 1);
		expect(second.nextBefore).toBeNull();
	});
});

describe('one day of the history', () => {
	it('says who read and who did not, with the portion each owed', async () => {
		const group = await createPlan();
		await readToday('m1', group.id);
		const day0 = await todayOf(group.id);
		goToDay(1);

		const day = await getHizbHistoryDay('owner', group.id, day0);

		expect(day.isToday).toBe(false);
		expect(day.members).toHaveLength(4);
		expect(rowOf(day, 'M1')).toMatchObject({ completed: true, isMe: false, assignmentId: null });
		// m3 never opened the app that day: no reading was made for them, yet they owed one.
		expect(rowOf(day, 'M3')).toMatchObject({ completed: false, assignmentId: null });
		expect(rowOf(day, 'M3')!.portion).toBeGreaterThanOrEqual(1);
	});

	it('gives the viewer their own reading to open, and nobody else’s', async () => {
		const group = await createPlan();
		const day0 = await todayOf(group.id);
		goToDay(2);

		const day = await getHizbHistoryDay('m2', group.id, day0);
		const mine = day.members.find(m => m.isMe)!;

		// Never opened on that day, so made now — the missed day can be read from here.
		expect(mine.assignmentId).not.toBeNull();
		expect(mine.completed).toBe(false);
		expect(day.members.filter(m => m.assignmentId !== null)).toHaveLength(1);
		const reading = await getHizbState('m2', group.id);
		expect(reading.missed.map(m => m.id)).toContain(mine.assignmentId);
	});

	it('marks today’s reading under way as started', async () => {
		const group = await createPlan();
		const today = (await getHizbState('m1', group.id)).today!;
		await updateHizbAssignment('m1', group.id, today.id, { version: today.version, bookmark: 2 });

		const day = await getHizbHistoryDay('owner', group.id, await todayOf(group.id));

		expect(day.isToday).toBe(true);
		expect(rowOf(day, 'M1')).toMatchObject({ completed: false, started: true });
		expect(rowOf(day, 'M2')).toMatchObject({ started: false });
	});

	it('hides others’ names as the group does — not from the owner, nor a responsible member', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, {
			hideMemberNames: true,
			readSeersEnabled: true,
			readerSeerUserIds: ['owner', 'm1']
		});
		const today = await todayOf(group.id);

		const asMember = await getHizbHistoryDay('m2', group.id, today);
		expect(asMember.members.filter(m => m.displayName !== null).map(m => m.isMe)).toEqual([true]);

		const names = (viewer: string) =>
			getHizbHistoryDay(viewer, group.id, today).then(d => d.members.filter(m => m.displayName !== null).length);
		expect(await names('owner')).toBe(4);
		expect(await names('m1')).toBe(4);

		// The tick counts only while "Okuma sorumluları" is on.
		await updateGroupForUser('owner', group.id, { readSeersEnabled: false });
		expect(await names('m1')).toBe(1);
	});

	it('keeps a member who left on the days they owed, and not after', async () => {
		const group = await createPlan();
		await readToday('m3', group.id);
		const day0 = await todayOf(group.id);
		goToDay(1);
		await leaveGroupForUser('m3', group.id);
		goToDay(2);

		const before = await getHizbHistoryDay('owner', group.id, day0);
		const left = before.members.find(m => m.hasLeft)!;
		expect(left).toMatchObject({ completed: true, displayName: null });
		// Leaving keeps the day they left on, which they had already committed to.
		expect((await getHizbHistoryDay('owner', group.id, day0 + 1)).members.some(m => m.hasLeft)).toBe(true);
		expect((await getHizbHistoryDay('owner', group.id, day0 + 2)).members.some(m => m.hasLeft)).toBe(false);
		expect((await getHizbHistoryDays('owner', group.id)).days[0]!.readers).toBe(3);
	});

	it('counts a reading kept past the end of its plan, so a day never reads more than its readers', async () => {
		const group = await createPlan(['m1']);
		const day0 = await todayOf(group.id);
		goToDay(2);
		await readToday('m1', group.id);
		// The inactivity rule can end a plan before days already opened (an undone read moves it
		// back); those days stay readable from the catch-up list.
		await prisma.hizbEnrollment.updateMany({
			where: { groupId: group.id, userId: 'm1' },
			data: { endDay: day0 + 1, reason: 'INACTIVITY' }
		});

		const today = (await getHizbHistoryDays('owner', group.id)).days[0]!;
		expect(today).toMatchObject({ read: 1, readers: 2 });
		expect(rowOf(await getHizbHistoryDay('owner', group.id, day0 + 2), 'M1')).toMatchObject({ completed: true });
		// Day 1 was made when day 2 was opened: still owed, and still in the catch-up list.
		expect(rowOf(await getHizbHistoryDay('owner', group.id, day0 + 1), 'M1')).toMatchObject({ completed: false });
	});

	it('lists a late joiner only from the day they joined', async () => {
		const group = await createPlan(['m1']);
		const day0 = await todayOf(group.id);
		goToDay(3);
		await joinGroupForUser('m2', 'M2', group.id);

		expect((await getHizbHistoryDay('owner', group.id, day0)).members.map(m => m.displayName)).toEqual([
			'Owner',
			'M1'
		]);
		expect((await getHizbHistoryDay('owner', group.id, day0 + 3)).members).toHaveLength(3);
	});

	it('answers only for the group’s own days, and only to its members', async () => {
		const group = await createPlan();
		const today = await todayOf(group.id);

		await expect(getHizbHistoryDay('owner', group.id, today + 1)).rejects.toMatchObject({ statusCode: 400 });
		await expect(getHizbHistoryDay('owner', group.id, today - 1)).rejects.toMatchObject({ statusCode: 400 });
		await expect(getHizbHistoryDay('stranger', group.id, today)).rejects.toMatchObject({ statusCode: 403 });
		await expect(getHizbHistoryDays('stranger', group.id)).rejects.toMatchObject({ statusCode: 403 });
	});
});
