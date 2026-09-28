import prisma from '@db/prisma';
import { getProfileStatsForUser } from '@services/profile.service';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const READER = 'profile_reader';
/** "Now" for every test: a Wednesday at noon UTC. */
const NOW = new Date('2026-10-14T12:00:00Z');

/** A Cevşen group the reads can hang off — `BabRead` needs a group row, nothing more. */
const createGroup = () =>
	prisma.group.create({
		data: {
			ownerUserId: READER,
			name: 'Profil',
			inviteCode: `PR${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
			spots: 20,
			cycle: 'DAILY',
			roundDays: 1,
			timezone: 'UTC',
			members: { create: [{ userId: READER, displayName: 'Reader', role: 'OWNER', slotIndex: 0 }] }
		}
	});

/** One read per instant, each a different bab so the unique key never collides. */
const readAt = async (groupId: string, instants: string[]) => {
	await prisma.babRead.createMany({
		data: instants.map((instant, index) => ({
			groupId,
			userId: READER,
			roundIndex: index,
			babNumber: 1,
			readAt: new Date(instant)
		}))
	});
};

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe('personal stats', () => {
	it('counts a streak of consecutive days that ends today', async () => {
		const group = await createGroup();
		await readAt(group.id, ['2026-10-12T09:00:00Z', '2026-10-13T09:00:00Z', '2026-10-14T09:00:00Z']);

		expect((await getProfileStatsForUser(READER, 'UTC')).streakDays).toBe(3);
	});

	it('keeps a streak that ended yesterday — not having read yet today does not break it', async () => {
		const group = await createGroup();
		await readAt(group.id, ['2026-10-12T09:00:00Z', '2026-10-13T09:00:00Z']);

		expect((await getProfileStatsForUser(READER, 'UTC')).streakDays).toBe(2);
	});

	it('breaks the streak on a missed day, but remembers the longest run ever', async () => {
		const group = await createGroup();
		// Four days in a row two months ago, a gap, then only today.
		await readAt(group.id, [
			'2026-08-01T09:00:00Z',
			'2026-08-02T09:00:00Z',
			'2026-08-03T09:00:00Z',
			'2026-08-04T09:00:00Z',
			'2026-10-12T09:00:00Z',
			'2026-10-14T09:00:00Z'
		]);

		const stats = await getProfileStatsForUser(READER, 'UTC');

		expect(stats.streakDays).toBe(1);
		// Beyond the thirty-day heatmap, and still the record.
		expect(stats.longestStreakDays).toBe(4);
	});

	it('buckets days in the viewer’s zone, not UTC', async () => {
		const group = await createGroup();
		// Monday 21:00 and Tuesday 19:00 in New York — both fall on Tuesday in UTC.
		await readAt(group.id, ['2026-10-13T01:00:00Z', '2026-10-13T23:00:00Z']);

		expect((await getProfileStatsForUser(READER, 'America/New_York')).longestStreakDays).toBe(2);
		expect((await getProfileStatsForUser(READER, 'UTC')).longestStreakDays).toBe(1);
	});

	it('draws the last thirty days ending today, with each day’s count', async () => {
		const group = await createGroup();
		await readAt(group.id, ['2026-10-14T08:00:00Z', '2026-10-14T10:00:00Z', '2026-09-15T09:00:00Z']);

		const { last30Days } = await getProfileStatsForUser(READER, 'UTC');

		expect(last30Days).toHaveLength(30);
		expect(last30Days.at(-1)).toEqual({ date: '2026-10-14', count: 2 });
		expect(last30Days[0]).toEqual({ date: '2026-09-15', count: 1 });
		expect(last30Days.reduce((sum, day) => sum + day.count, 0)).toBe(3);
	});

	it('is empty and zero for someone who has read nothing', async () => {
		const stats = await getProfileStatsForUser('nobody', 'UTC');

		expect(stats).toMatchObject({ babsRead: 0, roundsCompleted: 0, streakDays: 0, longestStreakDays: 0 });
		expect(stats.last30Days.every(day => day.count === 0)).toBe(true);
	});
});
