import prisma from '@db/prisma';
import { deleteAccountForUser } from '@services/account.service';
import { setAssignedBabsReadForUser, setBabReadForUser } from '@services/babs.service';
import { getPartRepetitionsForUser, setPartRepetitionsForUser } from '@services/repetitions.service';
import { coverMissedBabsForUser } from '@services/roundHistory.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, roundIndexSince, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

// Clerk is not what these tests are about; with no profiles every name is the stored one.
vi.mock('@utils/memberProfiles', async () => {
	const actual = await vi.importActual<typeof import('@utils/memberProfiles')>('@utils/memberProfiles');

	return { ...actual, getMemberProfiles: async () => new Map() };
});

const OWNER = 'test_owner';
const OTHER = 'test_other';

const SEKINE = 19;
/**
 * Eleven FIXED seats over 33 portions, three apiece. The owner sits in seat 6, whose block is
 * portions 19–21 every round — so Sekine is always in their share, whatever round a test is on.
 */
const SPOTS = 11;
const OWNER_SLOT = 6;
const OWNER_SHARE = [19, 20, 21];

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

let codeCounter = 0;
const nextInviteCode = () => `REPS${String(codeCounter++).padStart(4, '0')}`;

/**
 * A running group on the round its start date implies — unless `isBehind`, in which case the
 * stored round is one short and the first request that touches it performs the rollover.
 */
const createGroup = async ({
	kind = 'HIZB' as 'CEVSEN' | 'HIZB',
	status = 'RUNNING' as 'RUNNING' | 'GATHERING',
	startedDaysAgo = 0,
	isBehind = false
} = {}) => {
	const startedAt = daysAgo(startedDaysAgo);
	const roundIndex = roundIndexSince(startedAt, 'DAILY', new Date(), DEFAULT_TIME_ZONE) - (isBehind ? 1 : 0);
	const isRunning = status === 'RUNNING';

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: `${kind} Halkası`,
			inviteCode: nextInviteCode(),
			kind,
			spots: SPOTS,
			cycle: 'DAILY',
			splitMode: 'FIXED',
			status,
			startedAt: isRunning ? startedAt : null,
			roundIndex: isRunning ? roundIndex : 0,
			roundStartedAt: isRunning ? startedAt : null,
			timezone: DEFAULT_TIME_ZONE,
			members: {
				create: [
					{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: OWNER_SLOT, joinedAt: startedAt },
					{ userId: OTHER, displayName: 'Other', role: 'MEMBER', slotIndex: 0, joinedAt: startedAt }
				]
			}
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: kind === 'HIZB' ? 33 : 100 }, (_, index) => ({
			groupId: group.id,
			number: index + 1
		}))
	});

	return group;
};

const readerOf = async (groupId: string, number: number) =>
	(await prisma.groupBab.findUniqueOrThrow({ where: { groupId_number: { groupId, number } } })).readByUserId;

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('setPartRepetitionsForUser / getPartRepetitionsForUser', () => {
	it('starts at zero, out of nineteen', async () => {
		const group = await createGroup();

		expect(await getPartRepetitionsForUser(OWNER, group.id, SEKINE)).toEqual({
			count: 0,
			required: 19,
			roundIndex: group.roundIndex
		});
	});

	it('stores an absolute count, so a retried PUT changes nothing', async () => {
		const group = await createGroup();

		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 5 });
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 5 });

		expect(await getPartRepetitionsForUser(OWNER, group.id, SEKINE)).toEqual({
			count: 5,
			required: 19,
			roundIndex: group.roundIndex
		});
	});

	it('refuses more than the part asks for', async () => {
		const group = await createGroup();

		await expect(setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 20 })).rejects.toMatchObject({
			statusCode: 400
		});
	});

	it('refuses a part that is read once', async () => {
		const group = await createGroup();

		await expect(setPartRepetitionsForUser(OWNER, group.id, 18, { count: 1 })).rejects.toMatchObject({
			statusCode: 400
		});
		await expect(getPartRepetitionsForUser(OWNER, group.id, 18)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('refuses a Cevşen group, where nothing is repeated', async () => {
		const group = await createGroup({ kind: 'CEVSEN' });

		await expect(setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 1 })).rejects.toMatchObject({
			statusCode: 400
		});
	});

	it('refuses a round the group has not reached', async () => {
		const group = await createGroup();

		await expect(
			setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 1, roundIndex: group.roundIndex + 1 })
		).rejects.toMatchObject({ statusCode: 400 });
		await expect(getPartRepetitionsForUser(OWNER, group.id, SEKINE, group.roundIndex + 1)).rejects.toMatchObject({
			statusCode: 400
		});
	});

	it('refuses a group that has not started', async () => {
		const group = await createGroup({ status: 'GATHERING' });

		await expect(setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 1 })).rejects.toMatchObject({
			statusCode: 400
		});
	});

	it('refuses a non-member', async () => {
		const group = await createGroup();

		await expect(setPartRepetitionsForUser('test_stranger', group.id, SEKINE, { count: 1 })).rejects.toMatchObject({
			statusCode: 404
		});
	});

	it('says which round a count belongs to, named or not', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });
		const closedRound = group.roundIndex - 1;

		expect(await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 3 })).toEqual({
			count: 3,
			required: 19,
			roundIndex: group.roundIndex
		});
		expect(await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 8, roundIndex: closedRound })).toEqual(
			{
				count: 8,
				required: 19,
				roundIndex: closedRound
			}
		);
		expect(await getPartRepetitionsForUser(OWNER, group.id, SEKINE, closedRound)).toEqual({
			count: 8,
			required: 19,
			roundIndex: closedRound
		});
	});
});

describe('counting in the open round across a boundary', () => {
	it('refuses a count meant for the open round once that round has closed', async () => {
		const group = await createGroup({ startedDaysAgo: 1, isBehind: true });
		const leftRound = group.roundIndex;

		// The reader still shows the round the group is about to leave; the request rolls it first.
		await expect(
			setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 6, isOpenRound: true, roundIndex: leftRound })
		).rejects.toMatchObject({ statusCode: 409 });

		// Nothing was filed under either round.
		expect(await prisma.groupPartRepetition.count({ where: { groupId: group.id } })).toBe(0);
	});

	it('accepts it while the named round is still the open one', async () => {
		const group = await createGroup();

		expect(
			await setPartRepetitionsForUser(OWNER, group.id, SEKINE, {
				count: 6,
				isOpenRound: true,
				roundIndex: group.roundIndex
			})
		).toEqual({ count: 6, required: 19, roundIndex: group.roundIndex });
	});

	it('still lets a closed round be counted on purpose, for covering it', async () => {
		const group = await createGroup({ startedDaysAgo: 1, isBehind: true });
		const leftRound = group.roundIndex;

		expect(await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 6, roundIndex: leftRound })).toEqual({
			count: 6,
			required: 19,
			roundIndex: leftRound
		});
	});
});

describe('marking Sekine read', () => {
	it('is allowed once the reader has repeated it nineteen times', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 19 });

		const bab = await setBabReadForUser(OWNER, group.id, SEKINE, true);

		expect(bab.readByUserId).toBe(OWNER);
	});

	it('is refused one repetition short', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 18 });

		await expect(setBabReadForUser(OWNER, group.id, SEKINE, true)).rejects.toMatchObject({ statusCode: 409 });
		expect(await readerOf(group.id, SEKINE)).toBeNull();
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(0);
	});

	it('does not count another member’s repetitions', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OTHER, group.id, SEKINE, { count: 19 });

		await expect(setBabReadForUser(OWNER, group.id, SEKINE, true)).rejects.toMatchObject({ statusCode: 409 });
	});

	it('does not gate the parts around it', async () => {
		const group = await createGroup();

		await setBabReadForUser(OWNER, group.id, 20, true);

		expect(await readerOf(group.id, 20)).toBe(OWNER);
	});

	it('treats marking it again as the no-op it is, whatever the count says now', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 19 });
		await setBabReadForUser(OWNER, group.id, SEKINE, true);
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 0 });

		// A retry of a read that is already saved must not come back as a refusal.
		const bab = await setBabReadForUser(OWNER, group.id, SEKINE, true);

		expect(bab.readByUserId).toBe(OWNER);
		expect(await readerOf(group.id, SEKINE)).toBe(OWNER);
		expect(await prisma.babRead.count({ where: { groupId: group.id, babNumber: SEKINE, userId: OWNER } })).toBe(1);
		expect(await getPartRepetitionsForUser(OWNER, group.id, SEKINE)).toMatchObject({ count: 0 });
	});

	it('keeps the count when the read is undone', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 19 });
		await setBabReadForUser(OWNER, group.id, SEKINE, true);

		await setBabReadForUser(OWNER, group.id, SEKINE, false);

		expect(await readerOf(group.id, SEKINE)).toBeNull();
		expect(await getPartRepetitionsForUser(OWNER, group.id, SEKINE)).toMatchObject({ count: 19 });
	});

	it('starts the count again in a new round', async () => {
		const group = await createGroup({ startedDaysAgo: 1, isBehind: true });
		const leftRound = group.roundIndex;
		/*
		 * Nineteen in the round the group is about to leave, written straight to the table: going
		 * through the service would roll the group first and file them under the new round.
		 */
		await prisma.groupPartRepetition.create({
			data: { groupId: group.id, userId: OWNER, roundIndex: leftRound, partNumber: SEKINE, count: 19 }
		});

		// The first request after the boundary rolls, and the new round has no count of its own.
		expect(await getPartRepetitionsForUser(OWNER, group.id, SEKINE)).toEqual({
			count: 0,
			required: 19,
			roundIndex: leftRound + 1
		});
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).roundIndex).toBe(leftRound + 1);
		// The round that closed keeps its own.
		expect(await getPartRepetitionsForUser(OWNER, group.id, SEKINE, leftRound)).toEqual({
			count: 19,
			required: 19,
			roundIndex: leftRound
		});
		await expect(setBabReadForUser(OWNER, group.id, SEKINE, true)).rejects.toMatchObject({ statusCode: 409 });

		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 19 });
		await setBabReadForUser(OWNER, group.id, SEKINE, true);

		expect(await readerOf(group.id, SEKINE)).toBe(OWNER);
	});
});

describe('marking a whole share that holds Sekine', () => {
	it('refuses the whole request, rather than skipping Sekine', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 3 });

		await expect(setAssignedBabsReadForUser(OWNER, group.id, true)).rejects.toMatchObject({ statusCode: 409 });

		expect(
			await prisma.groupBab.count({
				where: { groupId: group.id, number: { in: OWNER_SHARE }, readAt: { not: null } }
			})
		).toBe(0);
	});

	it('marks it all once Sekine has its nineteen', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 19 });

		await setAssignedBabsReadForUser(OWNER, group.id, true);

		expect(
			await prisma.groupBab.count({
				where: { groupId: group.id, number: { in: OWNER_SHARE }, readByUserId: OWNER }
			})
		).toBe(3);
	});
});

describe('covering Sekine in a closed round', () => {
	it('needs that round’s own nineteen, not the current round’s', async () => {
		const group = await createGroup({ startedDaysAgo: 1 });
		const closedRound = group.roundIndex - 1;
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 19 });

		await expect(coverMissedBabsForUser(OWNER, group.id, closedRound, [SEKINE])).rejects.toMatchObject({
			statusCode: 409
		});
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(0);

		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 19, roundIndex: closedRound });
		const detail = await coverMissedBabsForUser(OWNER, group.id, closedRound, [SEKINE]);

		expect(detail.babs.find(bab => bab.number === SEKINE)?.readByUserId).toBe(OWNER);
	});

	it('does not hold the rest of a block to a Sekine somebody else already covered', async () => {
		const group = await createGroup({ startedDaysAgo: 1 });
		const closedRound = group.roundIndex - 1;
		await setPartRepetitionsForUser(OTHER, group.id, SEKINE, { count: 19, roundIndex: closedRound });
		await coverMissedBabsForUser(OTHER, group.id, closedRound, [SEKINE]);

		// The owner has no count of their own for that round, and is not writing Sekine anyway.
		const detail = await coverMissedBabsForUser(OWNER, group.id, closedRound, OWNER_SHARE);
		const readerByNumber = new Map(detail.babs.map(bab => [bab.number, bab.readByUserId]));

		expect(readerByNumber.get(SEKINE)).toBe(OTHER);
		expect(readerByNumber.get(20)).toBe(OWNER);
		expect(readerByNumber.get(21)).toBe(OWNER);
	});

	it('still answers a fully covered request as already read', async () => {
		const group = await createGroup({ startedDaysAgo: 1 });
		const closedRound = group.roundIndex - 1;
		await setPartRepetitionsForUser(OTHER, group.id, SEKINE, { count: 19, roundIndex: closedRound });
		await coverMissedBabsForUser(OTHER, group.id, closedRound, [SEKINE]);

		await expect(coverMissedBabsForUser(OWNER, group.id, closedRound, [SEKINE])).rejects.toMatchObject({
			statusCode: 409,
			message: 'These babs have already been read'
		});
	});
});

describe('setting a count on a group behind the calendar', () => {
	it('rolls first, so the count lands in the round that is open', async () => {
		const group = await createGroup({ startedDaysAgo: 1, isBehind: true });

		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 7 });

		const row = await prisma.groupPartRepetition.findFirstOrThrow({ where: { groupId: group.id } });

		expect(row.roundIndex).toBe(group.roundIndex + 1);
	});
});

describe('deleting an account', () => {
	it('takes the member’s repetition counts with it, and leaves everyone else’s', async () => {
		const group = await createGroup();
		await setPartRepetitionsForUser(OWNER, group.id, SEKINE, { count: 4 });
		await setPartRepetitionsForUser(OTHER, group.id, SEKINE, { count: 7 });

		await deleteAccountForUser(OTHER);

		expect(await prisma.groupPartRepetition.count({ where: { userId: OTHER } })).toBe(0);
		expect(await prisma.groupPartRepetition.count({ where: { userId: OWNER } })).toBe(1);
	});
});
