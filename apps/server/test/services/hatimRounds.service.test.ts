import prisma from '@db/prisma';
import { ensureCurrentRound, expectedRoundIndex } from '@services/rounds.service';
import { holdingsFor } from '@services/unitPlan';
import { CUZ_COUNT } from '@utils/units';
import { civilDayNumber, DEFAULT_TIME_ZONE, roundEndsAt, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const OTHER = 'test_other';

/**
 * The four answers QC3 can give, and what each one means once the calendar moves.
 *
 * Three of them are cadences and one is not, which is the whole point: `DAILY`, `WEEKLY` and
 * `MONTHLY` roll every 1, 7 and 30 days, while a one-off runs its length and stops. Tested
 * together because the bug they share is a fall-through — for a long time anything that was
 * not `DAILY` was treated as weekly, and the way that failed was silence.
 */
const daysAgo = (days: number): Date =>
	startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE) - days, DEFAULT_TIME_ZONE);

const createHatim = async ({
	boundaryPolicy = 'KEEP' as 'KEEP' | 'REPICK',
	cycle,
	holdings = [{ cuzNumber: 7, userId: OWNER }],
	roundDays,
	startedDaysAgo
}: {
	boundaryPolicy?: 'KEEP' | 'REPICK';
	cycle: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
	holdings?: { cuzNumber: number; isLoan?: boolean; userId: string }[];
	roundDays: number;
	startedDaysAgo: number;
}) => {
	const startedAt = daysAgo(startedDaysAgo);

	const group = await prisma.group.create({
		data: {
			boundaryPolicy,
			cycle,
			distribution: 'FREE_PICK',
			endsAt: roundEndsAt(startedAt, roundDays, 0, DEFAULT_TIME_ZONE),
			inviteCode: `Q${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind: 'HATIM',
			name: 'Round Hatmi',
			ownerUserId: OWNER,
			roundDays,
			roundIndex: 0,
			roundStartedAt: startedAt,
			spots: CUZ_COUNT,
			splitMode: 'FIXED',
			startedAt,
			startsAt: startedAt,
			status: 'RUNNING',
			timezone: DEFAULT_TIME_ZONE
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: CUZ_COUNT }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});

	await prisma.groupMember.createMany({
		data: [
			{ displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER },
			{ displayName: 'Other', groupId: group.id, role: 'MEMBER', slotIndex: 1, userId: OTHER }
		]
	});

	await prisma.cuzHolding.createMany({
		data: holdings.map(holding => ({ ...holding, groupId: group.id, roundIndex: 0 }))
	});

	return group;
};

const roll = async (groupId: string) => prisma.$transaction(tx => ensureCurrentRound(tx, groupId));

beforeEach(async () => {
	await prisma.babRead.deleteMany();
	await prisma.cuzHolding.deleteMany();
	await prisma.groupMember.deleteMany();
	await prisma.groupBab.deleteMany();
	await prisma.group.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('a hatim rolls on its own length', () => {
	it.each([
		{ cycle: 'DAILY' as const, expected: 3, roundDays: 1, startedDaysAgo: 3 },
		{ cycle: 'WEEKLY' as const, expected: 2, roundDays: 7, startedDaysAgo: 14 },
		{ cycle: 'MONTHLY' as const, expected: 2, roundDays: 30, startedDaysAgo: 60 }
	])('$cycle advances a round every $roundDays days', async ({ cycle, expected, roundDays, startedDaysAgo }) => {
		const group = await createHatim({ cycle, roundDays, startedDaysAgo });

		expect(await roll(group.id)).toBe(true);

		const rolled = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });

		expect(rolled.roundIndex).toBe(expected);
		// The boundary is recomputed from the round it actually landed on, not from the start.
		expect(rolled.endsAt).toEqual(
			startOfCivilDay(
				civilDayNumber(rolled.roundStartedAt ?? new Date(), DEFAULT_TIME_ZONE) + roundDays,
				DEFAULT_TIME_ZONE
			)
		);
	});

	it('never rolls a one-off, however long it has been running', async () => {
		/*
		 * The bug this exists for: a CUSTOM group treated as a cadence would start a second
		 * pass nobody asked for, wipe a board that had just been completed, and do it again
		 * every N days for ever.
		 */
		const group = await createHatim({ cycle: 'CUSTOM', roundDays: 15, startedDaysAgo: 400 });

		expect(expectedRoundIndex(group)).toBe(0);
		expect(await roll(group.id)).toBe(false);
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).roundIndex).toBe(0);
	});
});

describe('what happens to the cüz at the boundary', () => {
	it('carries every holding forward under KEEP', async () => {
		/*
		 * Without this the rollover left nobody holding anything: `CuzHolding` is keyed by
		 * round, so a group that was half read woke up with an empty share and a board that
		 * was entirely pool — and nothing raised, because "no holdings" is a valid answer.
		 */
		const group = await createHatim({
			boundaryPolicy: 'KEEP',
			cycle: 'DAILY',
			holdings: [
				{ cuzNumber: 7, userId: OWNER },
				{ cuzNumber: 22, userId: OWNER },
				{ cuzNumber: 1, userId: OTHER }
			],
			roundDays: 1,
			startedDaysAgo: 2
		});

		await roll(group.id);

		const rolled = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
		const carried = await holdingsFor(prisma, rolled, rolled.roundIndex);

		const mine = carried
			.filter(holding => holding.userId === OWNER)
			.map(holding => holding.cuzNumber)
			// A numeric comparator: the default sorts lexicographically, so 22 lands before 7.
			.sort((a, b) => a - b);

		expect(mine).toEqual([7, 22]);
		expect(carried).toHaveLength(3);
	});

	it('returns a cüz borrowed from the havuz, even under KEEP', async () => {
		/*
		 * **A loan lasts one round, whatever the policy says.** Taking a spare cüz out of the
		 * havuz is "I'll cover this one this time round" — the same promise a Cevşen pool
		 * claim makes, which the rollover ends by clearing `assignedUserId`. Carried forward
		 * by KEEP along with everything else, every favour would silently become a permanent
		 * holding and the havuz would drain a round at a time.
		 */
		const group = await createHatim({
			boundaryPolicy: 'KEEP',
			cycle: 'DAILY',
			holdings: [
				{ cuzNumber: 7, userId: OWNER },
				{ cuzNumber: 22, isLoan: true, userId: OWNER }
			],
			roundDays: 1,
			startedDaysAgo: 2
		});

		await roll(group.id);

		const rolled = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
		const carried = await holdingsFor(prisma, rolled, rolled.roundIndex);

		expect(carried.map(holding => holding.cuzNumber)).toEqual([7]);
		// The round it was lent in keeps its record, so who covered what is not lost.
		expect(await holdingsFor(prisma, rolled, 0)).toHaveLength(2);
	});

	it('empties the map under REPICK', async () => {
		const group = await createHatim({
			boundaryPolicy: 'REPICK',
			cycle: 'DAILY',
			holdings: [{ cuzNumber: 7, userId: OWNER }],
			roundDays: 1,
			startedDaysAgo: 2
		});

		await roll(group.id);

		const rolled = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });

		expect(await holdingsFor(prisma, rolled, rolled.roundIndex)).toEqual([]);
		// The round it left keeps its record — a repick forgets nothing, it just starts over.
		expect(await holdingsFor(prisma, rolled, 0)).toHaveLength(1);
	});

	it('carries from the round it left, not from every round it skipped', async () => {
		// A group nobody opened for three days rolls straight from the last round anybody
		// touched, so the copy has to start there rather than from the target.
		const group = await createHatim({
			boundaryPolicy: 'KEEP',
			cycle: 'DAILY',
			holdings: [{ cuzNumber: 7, userId: OWNER }],
			roundDays: 1,
			startedDaysAgo: 3
		});

		await roll(group.id);

		const rolled = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });

		expect(rolled.roundIndex).toBe(3);
		expect(await holdingsFor(prisma, rolled, 3)).toHaveLength(1);
		// Nothing was written into the rounds in between; they were never opened.
		expect(await holdingsFor(prisma, rolled, 1)).toEqual([]);
	});

	it('clears the board but keeps the record', async () => {
		const group = await createHatim({ cycle: 'DAILY', roundDays: 1, startedDaysAgo: 1 });

		await prisma.groupBab.updateMany({
			data: { readAt: new Date(), readByUserId: OWNER },
			where: { groupId: group.id, number: 7 }
		});
		await prisma.babRead.create({
			data: { babNumber: 7, groupId: group.id, roundIndex: 0, userId: OWNER }
		});

		await roll(group.id);

		expect(await prisma.groupBab.count({ where: { groupId: group.id, readAt: { not: null } } })).toBe(0);
		// `BabRead` is what every streak, total and history reads — the rollover must not touch it.
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(1);
	});
});
