import prisma from '@db/prisma';
import { coverMissedBabsForUser, getRoundDetailForUser, listRoundsForUser } from '@services/roundHistory.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const OTHER = 'test_other';
/** Seat 1's user id, built the same way `createGroup` builds it — a real member. */
const SEAT_ONE = `${OTHER}_1`;
const SPOTS = 10;
const BLOCK = 100 / SPOTS;

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

/**
 * A DAILY group started `startedDaysAgo` days ago, so it sits on that round with every
 * earlier one closed. `seats` decides which slots have a member — a slot left out is an
 * empty seat, and its block is pool.
 */
const createGroup = async ({
	startedDaysAgo = 3,
	seats = [0, 1],
	splitMode = 'ROTATION' as 'ROTATION' | 'FIXED'
} = {}) => {
	const startedAt = daysAgo(startedDaysAgo);

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: 'History Hatmi',
			inviteCode: `H${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			spots: SPOTS,
			cycle: 'DAILY',
			splitMode,
			status: 'RUNNING',
			startedAt,
			roundIndex: startedDaysAgo,
			roundStartedAt: startedAt,
			timezone: DEFAULT_TIME_ZONE
		}
	});

	await prisma.groupMember.createMany({
		data: seats.map(slotIndex => ({
			groupId: group.id,
			userId: slotIndex === 0 ? OWNER : `${OTHER}_${slotIndex}`,
			displayName: `Seat ${slotIndex}`,
			role: slotIndex === 0 ? ('OWNER' as const) : ('MEMBER' as const),
			slotIndex
		}))
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: 100 }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});

	return group;
};

const recordHistory = (groupId: string, roundIndex: number, babNumbers: number[], userId = OWNER) =>
	prisma.babRead.createMany({
		data: babNumbers.map(babNumber => ({ babNumber, groupId, roundIndex, userId }))
	});

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('listRoundsForUser', () => {
	it('lists every round newest first and flags only the current one as open', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		const rounds = await listRoundsForUser(OWNER, group.id);

		expect(rounds.map(round => round.roundIndex)).toEqual([3, 2, 1, 0]);
		expect(rounds.filter(round => round.isOpen).map(round => round.roundIndex)).toEqual([3]);
	});

	it('counts a closed round’s misses from the history, not the board', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [1, 2, 3, 4, 5]);

		const round1 = (await listRoundsForUser(OWNER, group.id)).find(round => round.roundIndex === 1);

		expect(round1?.readCount).toBe(5);
		expect(round1?.missedCount).toBe(95);
	});

	it('never reports the open round as having missed anything — the day is not over', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		const open = (await listRoundsForUser(OWNER, group.id)).find(round => round.isOpen);

		expect(open?.readCount).toBe(0);
		expect(open?.missedCount).toBe(0);
	});
});

describe('getRoundDetailForUser', () => {
	it('attributes each bab to the seat that owed it in THAT round, not today', async () => {
		const group = await createGroup({ startedDaysAgo: 3, splitMode: 'ROTATION' });

		const round0 = await getRoundDetailForUser(OWNER, group.id, 0);
		const round1 = await getRoundDetailForUser(OWNER, group.id, 1);

		// Seat 0 read block 0 in round 0 and block 1 in round 1, so bab 1 was owed by seat 0
		// in round 0 and by the seat that rotated onto block 0 — seat 9 — in round 1.
		expect(round0.babs[0]?.owedBySlotIndex).toBe(0);
		expect(round1.babs[0]?.owedBySlotIndex).toBe(SPOTS - 1);
		// And the block seat 0 owed in round 1 is the next one along.
		expect(round1.babs[BLOCK]?.owedBySlotIndex).toBe(0);
	});

	it('keeps a FIXED group’s attribution still across rounds', async () => {
		const group = await createGroup({ startedDaysAgo: 3, splitMode: 'FIXED' });

		const round0 = await getRoundDetailForUser(OWNER, group.id, 0);
		const round2 = await getRoundDetailForUser(OWNER, group.id, 2);

		expect(round0.babs[0]?.owedBySlotIndex).toBe(0);
		expect(round2.babs[0]?.owedBySlotIndex).toBe(0);
	});

	it('marks blocks belonging to empty seats as pool, owed by nobody', async () => {
		// Only seats 0 and 1 are filled, so eight blocks have no member behind them.
		const group = await createGroup({ startedDaysAgo: 2, seats: [0, 1] });

		const detail = await getRoundDetailForUser(OWNER, group.id, 0);
		const pool = detail.babs.filter(bab => bab.isPool);

		expect(pool).toHaveLength(100 - 2 * BLOCK);
		expect(pool.every(bab => bab.owedByUserId === null)).toBe(true);
	});

	it('counts people, not babs, for the missed-people stat', async () => {
		const group = await createGroup({ startedDaysAgo: 2, seats: [0, 1] });
		// Everything read except two babs, both owed by seat 0 in round 0.
		const all = Array.from({ length: 100 }, (_, index) => index + 1);
		await recordHistory(
			group.id,
			0,
			all.filter(number => number !== 1 && number !== 2)
		);

		const detail = await getRoundDetailForUser(OWNER, group.id, 0);

		expect(detail.missedCount).toBe(2);
		expect(detail.missedPeopleCount).toBe(1);
	});
});

describe('coverMissedBabsForUser', () => {
	it('records the cover against the round that missed it, crediting the coverer', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		await coverMissedBabsForUser(SEAT_ONE, group.id, 1, [7]);

		const row = await prisma.babRead.findFirst({ where: { groupId: group.id, roundIndex: 1, babNumber: 7 } });

		expect(row?.userId).toBe(SEAT_ONE);
		// Written into round 1's history — not moved into the round now open.
		expect(await prisma.babRead.count({ where: { groupId: group.id, roundIndex: 3 } })).toBe(0);
	});

	it('turns a miss into a read without touching the current board', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		const before = await getRoundDetailForUser(OWNER, group.id, 1);
		await coverMissedBabsForUser(OWNER, group.id, 1, [7]);
		const after = await getRoundDetailForUser(OWNER, group.id, 1);

		expect(after.missedCount).toBe(before.missedCount - 1);
		expect(after.readCount).toBe(before.readCount + 1);
		// `GroupBab` describes the round in progress; a closed round must not write to it.
		expect(await prisma.groupBab.count({ where: { groupId: group.id, readByUserId: { not: null } } })).toBe(0);
	});

	it('leaves the original reader in place — a cover fills a gap, it never displaces', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [7], OWNER);

		await expect(coverMissedBabsForUser(SEAT_ONE, group.id, 1, [7])).rejects.toThrow();

		const row = await prisma.babRead.findFirst({ where: { groupId: group.id, roundIndex: 1, babNumber: 7 } });
		expect(row?.userId).toBe(OWNER);
	});

	it('refuses to cover the open round, which the ordinary read paths own', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		await expect(coverMissedBabsForUser(OWNER, group.id, 3, [7])).rejects.toThrow();
	});

	it('refuses a round the group has never reached', async () => {
		const group = await createGroup({ startedDaysAgo: 1 });

		await expect(coverMissedBabsForUser(OWNER, group.id, 9, [7])).rejects.toThrow();
	});

	it('covers a whole block in one act', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		const block = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

		const detail = await coverMissedBabsForUser(SEAT_ONE, group.id, 1, block);

		expect(detail.readCount).toBe(block.length);
		expect(await prisma.babRead.count({ where: { groupId: group.id, roundIndex: 1, userId: SEAT_ONE } })).toBe(
			block.length
		);
	});

	it('writes what is still missing when part of the block was already covered', async () => {
		// Losing the whole generous act because one bab was taken a second earlier would be
		// a poor way to answer it — the rest still goes through.
		const group = await createGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [2], OWNER);

		const detail = await coverMissedBabsForUser(SEAT_ONE, group.id, 1, [1, 2, 3]);

		expect(detail.readCount).toBe(3);
		expect(
			(await prisma.babRead.findFirst({ where: { groupId: group.id, roundIndex: 1, babNumber: 2 } }))?.userId
		).toBe(OWNER);
	});

	it('is permanent — a later rollover does not undo it', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		await coverMissedBabsForUser(OWNER, group.id, 1, [7]);

		// Age the group so the next read rolls it forward again.
		await prisma.group.update({
			where: { id: group.id },
			data: { startedAt: daysAgo(9), roundStartedAt: daysAgo(9) }
		});

		const detail = await getRoundDetailForUser(OWNER, group.id, 1);

		expect(detail.babs.find(bab => bab.number === 7)?.readByUserId).toBe(OWNER);
	});
});
