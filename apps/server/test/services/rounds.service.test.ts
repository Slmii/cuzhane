import prisma from '@db/prisma';
import { ensureCurrentRound, expectedRoundIndex } from '@services/rounds.service';
import { rangeForRound } from '@utils/babs';
import {
	civilDayNumber,
	DEFAULT_TIME_ZONE,
	ROUND_DAYS,
	roundEndsAt,
	roundStartedAtFor,
	startOfCivilDay
} from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const OTHER = 'test_other';
const SPOTS = 10;

/**
 * N whole days ago, counted and placed in the group's own zone.
 *
 * Midday local rather than a fixed UTC hour: the round index counts local calendar days, so
 * a fixture pinned to 10:00 UTC would land on the previous local day whenever the suite ran
 * late in the evening Istanbul time, and every day-count assertion would be off by one.
 */
const daysAgo = (days: number, timeZone: string = DEFAULT_TIME_ZONE): Date => {
	const today = civilDayNumber(new Date(), timeZone);

	return new Date(startOfCivilDay(today - days, timeZone).getTime() + 12 * 60 * 60 * 1000);
};

type GroupOptions = {
	cycle?: 'DAILY' | 'WEEKLY';
	timezone?: string;
	splitMode?: 'ROTATION' | 'FIXED';
	status?: 'GATHERING' | 'RUNNING';
	startedDaysAgo?: number | null;
	roundIndex?: number;
	readBabs?: number[];
	claimedBabs?: number[];
	completed?: boolean;
};

/** A group with its full hundred babs, plus whatever read/claim state the test needs. */
const createGroup = async (options: GroupOptions = {}) => {
	const {
		cycle = 'DAILY',
		timezone = DEFAULT_TIME_ZONE,
		splitMode = 'ROTATION',
		status = 'RUNNING',
		startedDaysAgo = 0,
		roundIndex = 0,
		readBabs = [],
		claimedBabs = [],
		completed = false
	} = options;

	const startedAt = status === 'RUNNING' && startedDaysAgo !== null ? daysAgo(startedDaysAgo) : null;
	const roundStartedAt = startedAt ? roundStartedAtFor(startedAt, ROUND_DAYS[cycle], roundIndex, timezone) : null;

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: 'Test Hatmi',
			inviteCode: `T${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			spots: SPOTS,
			cycle,
			timezone,
			splitMode,
			status,
			startedAt,
			roundIndex,
			roundStartedAt,
			endsAt: roundStartedAt ? roundEndsAt(roundStartedAt, cycle, timezone) : null,
			completedAt: completed ? new Date() : null
		}
	});

	await prisma.groupMember.createMany({
		data: [
			{ groupId: group.id, userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0 },
			{ groupId: group.id, userId: OTHER, displayName: 'Other', role: 'MEMBER', slotIndex: 1 }
		]
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: 100 }, (_, index) => {
			const babNumber = index + 1;
			const isRead = readBabs.includes(babNumber);

			// `GroupBab.number` and `BabRead.babNumber` name the same thing differently — the
			// board row and the history row were added at different times.
			return {
				groupId: group.id,
				number: babNumber,
				assignedUserId: claimedBabs.includes(babNumber) ? OWNER : null,
				readByUserId: isRead ? OWNER : null,
				readAt: isRead ? new Date() : null
			};
		})
	});

	// The permanent record every read also writes. The rollover must not touch these.
	if (readBabs.length > 0) {
		await prisma.babRead.createMany({
			data: readBabs.map(babNumber => ({ groupId: group.id, babNumber, userId: OWNER, roundIndex }))
		});
	}

	return group;
};

const roll = (groupId: string) => prisma.$transaction(tx => ensureCurrentRound(tx, groupId));

const reload = (groupId: string) => prisma.group.findUniqueOrThrow({ where: { id: groupId } });

beforeEach(async () => {
	// Cascades through members, babs and BabRead.
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('expectedRoundIndex', () => {
	it('is 0 for a GATHERING group however long ago it was created', () => {
		const group = {
			cycle: 'DAILY' as const,
			startedAt: daysAgo(30),
			status: 'GATHERING' as const,
			timezone: DEFAULT_TIME_ZONE
		};
		expect(expectedRoundIndex(group)).toBe(0);
	});

	it('is 0 for a RUNNING group that somehow has no start stamp', () => {
		const group = {
			cycle: 'DAILY' as const,
			startedAt: null,
			status: 'RUNNING' as const,
			timezone: DEFAULT_TIME_ZONE
		};
		expect(expectedRoundIndex(group)).toBe(0);
	});

	it('jumps straight to the round the calendar is on after a quiet stretch', () => {
		const group = {
			cycle: 'DAILY' as const,
			startedAt: daysAgo(3),
			status: 'RUNNING' as const,
			timezone: DEFAULT_TIME_ZONE
		};
		expect(expectedRoundIndex(group)).toBe(3);
	});

	it('counts a WEEKLY group in weeks, not days', () => {
		const group = {
			cycle: 'WEEKLY' as const,
			startedAt: daysAgo(20),
			status: 'RUNNING' as const,
			timezone: DEFAULT_TIME_ZONE
		};
		expect(expectedRoundIndex(group)).toBe(2);
	});
});

describe('ensureCurrentRound', () => {
	it('does nothing to a group already on the right round', async () => {
		const group = await createGroup({ startedDaysAgo: 0, readBabs: [1, 2, 3] });

		expect(await roll(group.id)).toBe(false);
		expect(await prisma.groupBab.count({ where: { groupId: group.id, readByUserId: { not: null } } })).toBe(3);
	});

	it('never rolls a group that has not been started', async () => {
		const group = await createGroup({ status: 'GATHERING', startedDaysAgo: null });

		expect(await roll(group.id)).toBe(false);
		expect((await reload(group.id)).roundIndex).toBe(0);
	});

	it('skips a multi-day gap in one step rather than replaying each round', async () => {
		const group = await createGroup({ cycle: 'DAILY', startedDaysAgo: 3, readBabs: [1, 2, 3, 4, 5] });

		expect(await roll(group.id)).toBe(true);
		expect((await reload(group.id)).roundIndex).toBe(3);
	});

	it('clears the board but leaves the permanent read history alone', async () => {
		const readBabs = [1, 2, 3, 4, 5];
		const group = await createGroup({ cycle: 'DAILY', startedDaysAgo: 2, readBabs });

		await roll(group.id);

		expect(await prisma.groupBab.count({ where: { groupId: group.id, readByUserId: { not: null } } })).toBe(0);
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(readBabs.length);
	});

	it('releases pool claims, so a block nobody covered is offered again', async () => {
		const group = await createGroup({ cycle: 'DAILY', startedDaysAgo: 1, claimedBabs: [51, 52, 53] });

		await roll(group.id);

		expect(await prisma.groupBab.count({ where: { groupId: group.id, assignedUserId: { not: null } } })).toBe(0);
	});

	it('clears a finished round’s completion stamp', async () => {
		const group = await createGroup({ cycle: 'DAILY', startedDaysAgo: 1, completed: true });

		await roll(group.id);

		expect((await reload(group.id)).completedAt).toBeNull();
	});

	it('re-anchors the round to the boundary it actually crossed, not to now', async () => {
		const startedDaysAgo = 3;
		const group = await createGroup({ cycle: 'DAILY', startedDaysAgo });

		await roll(group.id);
		const rolled = await reload(group.id);
		const expectedStart = roundStartedAtFor(daysAgo(startedDaysAgo), ROUND_DAYS.DAILY, 3, DEFAULT_TIME_ZONE);

		expect(rolled.roundStartedAt).toEqual(expectedStart);
		expect(rolled.endsAt).toEqual(roundEndsAt(expectedStart, 'DAILY', DEFAULT_TIME_ZONE));
	});

	it('lands a seat on the block the skipped-to round owes it', async () => {
		const group = await createGroup({ cycle: 'DAILY', splitMode: 'ROTATION', startedDaysAgo: 3 });

		await roll(group.id);

		// Seat 0 after three rounds reads seat 3's block — the same place it would have
		// reached had it rolled each midnight.
		expect(rangeForRound(0, SPOTS, (await reload(group.id)).roundIndex)).toEqual(rangeForRound(3, SPOTS, 0));
	});

	it('is idempotent — a second pass finds nothing to do', async () => {
		const group = await createGroup({ cycle: 'DAILY', startedDaysAgo: 3 });

		expect(await roll(group.id)).toBe(true);
		expect(await roll(group.id)).toBe(false);
		expect((await reload(group.id)).roundIndex).toBe(3);
	});

	it('anchors a rolled round to midnight in the group’s zone, not UTC', async () => {
		const timezone = 'America/New_York';
		const group = await createGroup({ cycle: 'DAILY', timezone, startedDaysAgo: 3 });

		await roll(group.id);
		const rolled = await reload(group.id);

		// The boundary is a New York midnight, which is 04:00 or 05:00 UTC depending on the
		// season — never 00:00. Asserting the UTC hour is what would have caught the old
		// behaviour, where every group rolled at UTC midnight whatever zone it lived in.
		expect(rolled.roundStartedAt).toEqual(
			startOfCivilDay(civilDayNumber(daysAgo(3, timezone), timezone) + 3, timezone)
		);
		expect(rolled.roundStartedAt?.getUTCHours()).not.toBe(0);
		expect([4, 5]).toContain(rolled.roundStartedAt?.getUTCHours());
	});

	it('lets only one of two simultaneous requests roll the group', async () => {
		const group = await createGroup({ cycle: 'DAILY', startedDaysAgo: 2 });

		const [first, second] = await Promise.all([roll(group.id), roll(group.id)]);

		expect([first, second].filter(Boolean)).toHaveLength(1);
		expect((await reload(group.id)).roundIndex).toBe(2);
	});
});
