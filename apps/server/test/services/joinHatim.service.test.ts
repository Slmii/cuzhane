import prisma from '@db/prisma';
import { joinGroupForUser } from '@services/groupMembership.service';
import { DEFAULT_TIME_ZONE } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const JOINER = 'test_joiner';

/**
 * **Joining a hatim is taking cüz, not taking a seat** — QJ3.
 *
 * Its `spots` is thirty only because `slotIndex` needs a ceiling, so every rule a Cevşen
 * group gets from the seat count has to be asked a different way here: full means the cüz
 * are gone, and a member who holds nothing is a member who reads nothing.
 */
const createHatim = async ({ maxPerMember = null as number | null, taken = [] as number[] } = {}) => {
	const group = await prisma.group.create({
		data: {
			boundaryPolicy: 'KEEP',
			cycle: 'WEEKLY',
			distribution: 'FREE_PICK',
			inviteCode: `J${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind: 'HATIM',
			maxPerMember,
			name: 'Join Hatmi',
			openToJoin: true,
			ownerUserId: OWNER,
			roundDays: 7,
			roundIndex: 0,
			roundStartedAt: new Date(),
			spots: CUZ_COUNT,
			splitMode: 'FIXED',
			startedAt: new Date(),
			startsAt: new Date(),
			status: 'RUNNING',
			timezone: DEFAULT_TIME_ZONE,
			visibility: 'OPEN'
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: CUZ_COUNT }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});
	await prisma.groupMember.create({
		data: { displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER }
	});

	if (taken.length > 0) {
		await prisma.cuzHolding.createMany({
			data: taken.map(cuzNumber => ({ cuzNumber, groupId: group.id, roundIndex: 0, userId: OWNER }))
		});
	}

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

describe('joining a hatim', () => {
	it('records the cüz the joiner picked', async () => {
		const group = await createHatim();

		await joinGroupForUser(JOINER, 'Joiner', group.id, [7, 22]);

		const held = await prisma.cuzHolding.findMany({
			orderBy: { cuzNumber: 'asc' },
			where: { groupId: group.id, userId: JOINER }
		});

		expect(held.map(holding => holding.cuzNumber)).toEqual([7, 22]);
		expect(held.every(holding => holding.roundIndex === 0)).toBe(true);
	});

	it('refuses a join with no cüz at all', async () => {
		// "You cannot be in a hatim and hold no cüz." Enforced here and not only by the
		// disabled button, because a disabled button is not a rule.
		const group = await createHatim();

		await expect(joinGroupForUser(JOINER, 'Joiner', group.id, [])).rejects.toThrow(/at least one/i);
		expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(1);
	});

	it('refuses more cüz than the cap allows', async () => {
		const group = await createHatim({ maxPerMember: 2 });

		await expect(joinGroupForUser(JOINER, 'Joiner', group.id, [1, 2, 3])).rejects.toThrow(/at most 2/i);
	});

	it('counts a repeated pick once against the cap', async () => {
		// Two of a cap of three would be spent on one cüz otherwise.
		const group = await createHatim({ maxPerMember: 2 });

		await joinGroupForUser(JOINER, 'Joiner', group.id, [5, 5, 9]);

		expect(await prisma.cuzHolding.count({ where: { groupId: group.id, userId: JOINER } })).toBe(2);
	});

	it('refuses a cüz somebody already holds', async () => {
		const group = await createHatim({ taken: [7] });

		await expect(joinGroupForUser(JOINER, 'Joiner', group.id, [7, 8])).rejects.toThrow(/already been taken/i);
		// All or nothing: cüz 8 was free, and they did not get it either.
		expect(await prisma.cuzHolding.count({ where: { groupId: group.id, userId: JOINER } })).toBe(0);
	});

	it('is full when the cüz are gone, not when the seats are', async () => {
		/*
		 * The state QJ2 exists for. One member holds all thirty while twenty-nine seats stand
		 * empty — a seat check would have waved this joiner straight in to read nothing.
		 */
		const group = await createHatim({ taken: Array.from({ length: CUZ_COUNT }, (_, index) => index + 1) });

		await expect(joinGroupForUser(JOINER, 'Joiner', group.id, [1])).rejects.toThrow(/full/i);
	});

	it('lets a Cevşen group be joined with no selection, as it always could', async () => {
		// Every installed app posts a join body without `cuzNumbers`; that must keep working.
		const group = await prisma.group.create({
			data: {
				cycle: 'DAILY',
				inviteCode: `C${Math.floor(performance.now() * 1000)
					.toString(36)
					.toUpperCase()
					.slice(-7)}`,
				kind: 'CEVSEN',
				name: 'Cevşen',
				openToJoin: true,
				ownerUserId: OWNER,
				roundDays: 1,
				spots: 10,
				splitMode: 'ROTATION',
				startsAt: new Date(),
				status: 'GATHERING',
				timezone: DEFAULT_TIME_ZONE,
				visibility: 'OPEN'
			}
		});

		await prisma.groupBab.createMany({
			data: Array.from({ length: 100 }, (_, index) => ({ groupId: group.id, number: index + 1 }))
		});
		await prisma.groupMember.create({
			data: { displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER }
		});

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		expect(await prisma.groupMember.count({ where: { groupId: group.id, userId: JOINER } })).toBe(1);
		expect(await prisma.cuzHolding.count({ where: { groupId: group.id } })).toBe(0);
	});
});
