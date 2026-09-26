import prisma from '@db/prisma';
import { setAssignedBabsReadForUser } from '@services/babs.service';
import { babNumbersForRound } from '@utils/babs';
import { DEFAULT_TIME_ZONE, ROUND_DAYS, roundEndsAt, roundStartedAtFor } from '@utils/rounds';
import { civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
/** Holds seat 1's rotated block *and* a pool block taken on top of it. */
const READER = 'test_reader';

const SPOTS = 6;
const ROUND_INDEX = 2;
/** Empty seats — their blocks are the pool this round. */
const CLAIMED_SLOT = 4;

const blockFor = (slotIndex: number) => babNumbersForRound(slotIndex, SPOTS, ROUND_INDEX);

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

/** A running group where the reader holds their own block and one volunteered from the pool. */
const createGroup = async () => {
	const startedAt = daysAgo(ROUND_INDEX);
	const roundStartedAt = roundStartedAtFor(startedAt, ROUND_DAYS.DAILY, ROUND_INDEX, DEFAULT_TIME_ZONE);
	const claimed = new Set(blockFor(CLAIMED_SLOT));

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: 'Read All Hatmi',
			inviteCode: `R${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			spots: SPOTS,
			cycle: 'DAILY',
			roundDays: 1,
			timezone: DEFAULT_TIME_ZONE,
			splitMode: 'ROTATION',
			status: 'RUNNING',
			startedAt,
			roundIndex: ROUND_INDEX,
			roundStartedAt,
			endsAt: roundEndsAt(roundStartedAt, 1, DEFAULT_TIME_ZONE),
			members: {
				create: [
					{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0 },
					{ userId: READER, displayName: 'Reader', role: 'MEMBER', slotIndex: 1 }
				]
			}
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: 100 }, (_, index) => {
			const number = index + 1;

			return {
				groupId: group.id,
				number,
				assignedUserId: claimed.has(number) ? READER : null,
				readByUserId: null,
				readAt: null
			};
		})
	});

	return group;
};

const readCount = async (groupId: string, numbers: number[]) =>
	prisma.groupBab.count({ where: { groupId, number: { in: numbers }, readByUserId: READER } });

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

describe('setAssignedBabsReadForUser', () => {
	it('marks the whole share — the rotated block and the pool blocks taken on top of it', async () => {
		// Home's ring counts both and offers to finish them in one tap, so the endpoint behind
		// it has to cover both. Marking only the rotated half left the ring barely moving.
		const group = await createGroup();
		const ownBlock = blockFor(1);
		const claimedBlock = blockFor(CLAIMED_SLOT);

		await setAssignedBabsReadForUser(READER, group.id, true);

		expect(await readCount(group.id, ownBlock)).toBe(ownBlock.length);
		expect(await readCount(group.id, claimedBlock)).toBe(claimedBlock.length);
	});

	it('leaves other members’ blocks alone', async () => {
		const group = await createGroup();
		const ownersBlock = blockFor(0);

		await setAssignedBabsReadForUser(READER, group.id, true);

		expect(await readCount(group.id, ownersBlock)).toBe(0);
	});

	it('undoes both halves too, and only the caller’s own reads', async () => {
		const group = await createGroup();
		const claimedBlock = blockFor(CLAIMED_SLOT);

		await setAssignedBabsReadForUser(READER, group.id, true);
		await setAssignedBabsReadForUser(READER, group.id, false);

		expect(await readCount(group.id, [...blockFor(1), ...claimedBlock])).toBe(0);
	});
});
