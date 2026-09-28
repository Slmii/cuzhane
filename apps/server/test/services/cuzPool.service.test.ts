import prisma from '@db/prisma';
import { listPoolCuzForUser, releasePoolCuzForUser, takePoolCuzForUser } from '@services/cuzPool.service';
import { takePoolSlotForUser } from '@services/pool.service';
import { ensureCurrentRound } from '@services/rounds.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, startOfCivilDay } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const OTHER = 'test_other';

const daysAgo = (days: number): Date =>
	startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE) - days, DEFAULT_TIME_ZONE);

/**
 * **The havuz of a hatim: the cüz nobody joined with.**
 *
 * Taking one is a *loan* — it covers this round and goes back at the boundary whatever
 * `boundaryPolicy` says, which is the promise `isLoan` carries and the rollover honours.
 */
const createHatim = async ({
	boundaryPolicy = 'KEEP' as 'KEEP' | 'REPICK',
	holdings = [{ cuzNumber: 1, userId: OWNER }] as { cuzNumber: number; isLoan?: boolean; userId: string }[],
	maxPerMember = null as number | null,
	startedDaysAgo = 0
} = {}) => {
	const startedAt = daysAgo(startedDaysAgo);

	const group = await prisma.group.create({
		data: {
			boundaryPolicy,
			cycle: 'WEEKLY',
			distribution: 'FREE_PICK',
			inviteCode: `P${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind: 'HATIM',
			maxPerMember,
			name: 'Havuz Hatmi',
			ownerUserId: OWNER,
			roundDays: 7,
			roundIndex: 0,
			roundStartedAt: startedAt,
			spots: CUZ_COUNT,
			splitMode: 'FIXED',
			startedAt,
			startsAt: startedAt,
			status: 'RUNNING',
			timezone: DEFAULT_TIME_ZONE,
			visibility: 'OPEN'
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

describe('what the havuz lists', () => {
	it('offers every cüz nobody holds, and not the ones members joined with', async () => {
		const group = await createHatim({ holdings: [{ cuzNumber: 1, userId: OWNER }] });

		const pool = await listPoolCuzForUser(OTHER, group.id);

		expect(pool).toHaveLength(CUZ_COUNT - 1);
		expect(pool.some(cuz => cuz.cuzNumber === 1)).toBe(false);
	});

	it('keeps a borrowed cüz listed, with its holder named', async () => {
		/*
		 * A loan has to stay in the list or it would vanish the instant it was taken — and with
		 * it the only way to hand it back. The Cevşen screen keeps a claimed slot listed for
		 * exactly this reason.
		 */
		const group = await createHatim({
			holdings: [
				{ cuzNumber: 1, userId: OWNER },
				{ cuzNumber: 9, isLoan: true, userId: OTHER }
			]
		});

		const borrowed = (await listPoolCuzForUser(OTHER, group.id)).find(cuz => cuz.cuzNumber === 9);

		expect(borrowed?.takenByUserId).toBe(OTHER);
		expect(borrowed?.takenByMe).toBe(true);
		expect(borrowed?.takenByDisplayName).toBe('Other');
	});
});

describe('taking a cüz from the havuz', () => {
	it('records it as a loan, not as a holding of your own', async () => {
		const group = await createHatim();

		await takePoolCuzForUser(OTHER, group.id, 9);

		const holding = await prisma.cuzHolding.findFirstOrThrow({
			where: { cuzNumber: 9, groupId: group.id, roundIndex: 0 }
		});

		expect(holding.userId).toBe(OTHER);
		expect(holding.isLoan).toBe(true);
	});

	it('refuses one somebody already holds', async () => {
		const group = await createHatim();

		await expect(takePoolCuzForUser(OTHER, group.id, 1)).rejects.toThrow(/already been taken/i);
	});

	it('counts a loan against the cap', async () => {
		// Without this a group capped at one could be read entirely by whoever tapped fastest.
		const group = await createHatim({ holdings: [{ cuzNumber: 1, userId: OTHER }], maxPerMember: 1 });

		await expect(takePoolCuzForUser(OTHER, group.id, 9)).rejects.toThrow(/at most 1/i);
	});

	it('refuses while the hatim is still gathering', async () => {
		const group = await createHatim();
		await prisma.group.update({ data: { status: 'GATHERING' }, where: { id: group.id } });

		await expect(takePoolCuzForUser(OTHER, group.id, 9)).rejects.toThrow(/opens when the hatim starts/i);
	});
});

describe('giving one back', () => {
	it('returns it to the havuz and takes the read with it', async () => {
		const group = await createHatim();

		await takePoolCuzForUser(OTHER, group.id, 9);
		await prisma.groupBab.updateMany({
			data: { readAt: new Date(), readByUserId: OTHER },
			where: { groupId: group.id, number: 9 }
		});
		await prisma.babRead.create({ data: { babNumber: 9, groupId: group.id, roundIndex: 0, userId: OTHER } });

		await releasePoolCuzForUser(OTHER, group.id, 9);

		expect(await prisma.cuzHolding.count({ where: { cuzNumber: 9, groupId: group.id } })).toBe(0);
		expect(await prisma.babRead.count({ where: { babNumber: 9, groupId: group.id } })).toBe(0);
		const bab = await prisma.groupBab.findFirstOrThrow({ where: { groupId: group.id, number: 9 } });
		expect(bab.readByUserId).toBeNull();
	});

	it('refuses a cüz somebody joined with — that is leaving, not releasing', async () => {
		const group = await createHatim({ holdings: [{ cuzNumber: 1, userId: OTHER }] });

		await expect(releasePoolCuzForUser(OTHER, group.id, 1)).rejects.toThrow(/not yours to give back/i);
		expect(await prisma.cuzHolding.count({ where: { cuzNumber: 1, groupId: group.id } })).toBe(1);
	});

	it('refuses somebody else’s loan', async () => {
		const group = await createHatim({
			holdings: [
				{ cuzNumber: 1, userId: OWNER },
				{ cuzNumber: 9, isLoan: true, userId: OWNER }
			]
		});

		await expect(releasePoolCuzForUser(OTHER, group.id, 9)).rejects.toThrow(/not yours to give back/i);
	});
});

describe('what the boundary does with a loan', () => {
	it('hands it back even under KEEP, while the joined cüz carries forward', async () => {
		const group = await createHatim({ boundaryPolicy: 'KEEP' });

		/*
		 * Borrowed **inside** the round, then the round is aged out from under it.
		 *
		 * The obvious setup — start the group eight days ago and then take the cüz — proves
		 * nothing: every mutating path runs `ensureCurrentRound` first, so the take rolls the
		 * group itself and files the loan in the *new* round. It then carried forward, exactly
		 * as it should have, and the test read that as the bug it was looking for.
		 */
		await takePoolCuzForUser(OTHER, group.id, 9);
		// `expectedRoundIndex` counts from `startedAt`, not from `roundStartedAt` — the round
		// a group is on is derived from when it began, so that is the date to age.
		await prisma.group.update({
			data: { roundStartedAt: daysAgo(8), startedAt: daysAgo(8) },
			where: { id: group.id }
		});
		await prisma.$transaction(tx => ensureCurrentRound(tx, group.id));

		const rolled = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
		const carried = await prisma.cuzHolding.findMany({
			where: { groupId: group.id, roundIndex: rolled.roundIndex }
		});

		expect(carried.map(holding => holding.cuzNumber)).toEqual([1]);
		// And the havuz offers it again.
		expect((await listPoolCuzForUser(OTHER, group.id)).some(cuz => cuz.cuzNumber === 9)).toBe(true);
	});
});

describe('the Cevşen seat pool is not a hatim’s havuz', () => {
	it('refuses a seat-block claim on a hatim, so no bab-worded release can follow it', async () => {
		const group = await createHatim();

		await expect(takePoolSlotForUser(OTHER, group.id, 2)).rejects.toThrow(/cüz havuz/i);
		expect(await prisma.groupBab.count({ where: { assignedUserId: { not: null }, groupId: group.id } })).toBe(0);
	});
});
