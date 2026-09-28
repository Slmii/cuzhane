import prisma from '@db/prisma';
import { joinGroupForUser } from '@services/groupMembership.service';
import {
	listPoolSlotsForUser,
	releasePoolPartForUser,
	takePoolPartForUser,
	takePoolSlotForUser
} from '@services/pool.service';
import { sendPushToUser } from '@services/push.service';
import { babNumbersForRound } from '@utils/babs';
import { civilDayNumber, DEFAULT_TIME_ZONE, roundEndsAt, roundStartedAtFor, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

// Clerk is not what these tests are about; with no profiles every name is the stored one.
vi.mock('@utils/memberProfiles', async () => {
	const actual = await vi.importActual<typeof import('@utils/memberProfiles')>('@utils/memberProfiles');

	return { ...actual, getMemberProfiles: async () => new Map() };
});

// Asserted on rather than delivered — nobody here has a token.
vi.mock('@services/push.service', async () => {
	const actual = await vi.importActual<typeof import('@services/push.service')>('@services/push.service');

	return { ...actual, sendPushToUser: vi.fn(async () => 0) };
});

const OWNER = 'test_owner';
const ALI = 'test_ali';
const AYSE = 'test_ayse';
const JOINER = 'test_joiner';

/** Eleven seats over the Hizb's 33 portions: three apiece. Seats 0-2 taken, 3-10 empty. */
const SPOTS = 11;
const PARTS = 33;
const ROUND_INDEX = 2;
/** The lowest empty seat — the one a joiner lands in. At round 2 it offers block 5, portions 16–18. */
const POOL_SLOT = 3;

const blockFor = (slotIndex: number) => babNumbersForRound(slotIndex, SPOTS, ROUND_INDEX, PARTS);
const [FIRST, SECOND, THIRD] = blockFor(POOL_SLOT) as [number, number, number];

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

let codeCounter = 0;
const nextInviteCode = () => `PART${String(codeCounter++).padStart(4, '0')}`;

const createGroup = async ({
	kind = 'HIZB' as 'CEVSEN' | 'HIZB',
	status = 'RUNNING' as 'RUNNING' | 'GATHERING'
} = {}) => {
	const startedAt = daysAgo(ROUND_INDEX);
	const isRunning = status === 'RUNNING';

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: 'Hizb Halkası',
			inviteCode: nextInviteCode(),
			kind,
			spots: SPOTS,
			cycle: 'DAILY',
			roundDays: 1,
			timezone: DEFAULT_TIME_ZONE,
			splitMode: 'ROTATION',
			status,
			startedAt: isRunning ? startedAt : null,
			roundIndex: isRunning ? ROUND_INDEX : 0,
			roundStartedAt: isRunning ? roundStartedAtFor(startedAt, 1, ROUND_INDEX, DEFAULT_TIME_ZONE) : null,
			endsAt: isRunning ? roundEndsAt(startedAt, 1, ROUND_INDEX, DEFAULT_TIME_ZONE) : null,
			members: {
				create: [
					{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0 },
					{ userId: ALI, displayName: 'Ali', role: 'MEMBER', slotIndex: 1 },
					{ userId: AYSE, displayName: 'Ayşe', role: 'MEMBER', slotIndex: 2 }
				]
			}
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: kind === 'HIZB' ? PARTS : 100 }, (_, index) => ({
			groupId: group.id,
			number: index + 1
		}))
	});

	return group;
};

const babAt = (groupId: string, number: number) =>
	prisma.groupBab.findUniqueOrThrow({ where: { groupId_number: { groupId, number } } });

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('takePoolPartForUser', () => {
	it('is the case under test: the empty seat offers three portions this round', () => {
		expect([FIRST, SECOND, THIRD]).toEqual([16, 17, 18]);
	});

	it('lets two members take different portions of one block', async () => {
		const group = await createGroup();

		await takePoolPartForUser(ALI, group.id, FIRST);
		await takePoolPartForUser(AYSE, group.id, SECOND);

		expect((await babAt(group.id, FIRST)).assignedUserId).toBe(ALI);
		expect((await babAt(group.id, SECOND)).assignedUserId).toBe(AYSE);
		expect((await babAt(group.id, THIRD)).assignedUserId).toBeNull();
	});

	it('lists each portion’s taker on the slot', async () => {
		const group = await createGroup();
		await takePoolPartForUser(ALI, group.id, FIRST);
		await takePoolPartForUser(AYSE, group.id, SECOND);

		const slot = (await listPoolSlotsForUser(ALI, group.id)).find(candidate => candidate.slotIndex === POOL_SLOT);

		expect(slot?.parts).toEqual([
			{
				number: FIRST,
				takenByUserId: ALI,
				takenByDisplayName: 'Ali',
				takenByImageUrl: null,
				takenByMe: true,
				isRead: false
			},
			{
				number: SECOND,
				takenByUserId: AYSE,
				takenByDisplayName: 'Ayşe',
				takenByImageUrl: null,
				takenByMe: false,
				isRead: false
			},
			{
				number: THIRD,
				takenByUserId: null,
				takenByDisplayName: null,
				takenByImageUrl: null,
				takenByMe: false,
				isRead: false
			}
		]);
		// The slot-level taker stays the first claimant, which is what the Cevşen screen reads.
		expect(slot?.takenByUserId).toBe(ALI);
	});

	it('lets exactly one of two simultaneous takes of a portion win', async () => {
		const group = await createGroup();

		const results = await Promise.allSettled([
			takePoolPartForUser(ALI, group.id, FIRST),
			takePoolPartForUser(AYSE, group.id, FIRST)
		]);

		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(result => result.status === 'rejected')).toMatchObject([{ reason: { statusCode: 409 } }]);
	});

	it('refuses a portion in somebody’s share', async () => {
		const group = await createGroup();
		// Seat 0 reads block 2 this round, portions 7–9.
		const ownersPart = blockFor(0)[0] as number;

		await expect(takePoolPartForUser(ALI, group.id, ownersPart)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('refuses a portion the Hizb does not have', async () => {
		const group = await createGroup();

		await expect(takePoolPartForUser(ALI, group.id, 34)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('refuses a Cevşen group, whose pool slots are taken whole', async () => {
		const group = await createGroup({ kind: 'CEVSEN' });

		await expect(takePoolPartForUser(ALI, group.id, 95)).rejects.toMatchObject({ statusCode: 400 });
		expect(await prisma.groupBab.count({ where: { groupId: group.id, assignedUserId: { not: null } } })).toBe(0);
	});

	it('refuses before the hatim starts', async () => {
		const group = await createGroup({ status: 'GATHERING' });

		await expect(takePoolPartForUser(ALI, group.id, FIRST)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('tells the rest of the group, naming the one portion', async () => {
		const group = await createGroup();

		await takePoolPartForUser(ALI, group.id, FIRST);

		const rows = await prisma.notification.findMany({
			where: { groupId: group.id, kind: 'POOL_BAB_CLAIMED' },
			select: { userId: true, payload: true }
		});

		expect(rows.map(row => row.userId).sort()).toEqual([AYSE, OWNER].sort());
		expect(rows[0]?.payload).toEqual({ range: String(FIRST), takerName: 'Ali' });
	});
});

describe('takePoolSlotForUser after a portion was taken', () => {
	it('takes what is left of the block, and announces only that', async () => {
		const group = await createGroup();
		await takePoolPartForUser(AYSE, group.id, SECOND);

		await takePoolSlotForUser(ALI, group.id, POOL_SLOT);

		expect((await babAt(group.id, SECOND)).assignedUserId).toBe(AYSE);
		expect((await babAt(group.id, FIRST)).assignedUserId).toBe(ALI);
		expect((await babAt(group.id, THIRD)).assignedUserId).toBe(ALI);

		const row = await prisma.notification.findFirstOrThrow({
			where: {
				groupId: group.id,
				kind: 'POOL_BAB_CLAIMED',
				userId: OWNER,
				payload: { path: ['takerName'], equals: 'Ali' }
			}
		});

		expect(row.payload).toEqual({ range: `${FIRST}, ${THIRD}`, takerName: 'Ali' });
	});
});

describe('joining a seat whose block several members took portions of', () => {
	const setUp = async () => {
		const group = await createGroup();
		await takePoolPartForUser(ALI, group.id, FIRST);
		await takePoolPartForUser(AYSE, group.id, SECOND);
		await takePoolPartForUser(ALI, group.id, THIRD);

		// Ali has already read one of his.
		await prisma.groupBab.update({
			where: { groupId_number: { groupId: group.id, number: FIRST } },
			data: { readByUserId: ALI, readAt: new Date() }
		});
		await prisma.babRead.create({
			data: { groupId: group.id, babNumber: FIRST, userId: ALI, roundIndex: ROUND_INDEX }
		});

		return group;
	};

	it('releases every claimant', async () => {
		const group = await setUp();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		expect(
			await prisma.groupBab.count({
				where: { groupId: group.id, number: { in: [FIRST, SECOND, THIRD] }, assignedUserId: { not: null } }
			})
		).toBe(0);
	});

	it('records one release per claimant per run of their own portions', async () => {
		const group = await setUp();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		const releases = await prisma.poolClaimRelease.findMany({
			where: { groupId: group.id },
			select: { userId: true, startBab: true, endBab: true, roundIndex: true },
			orderBy: [{ userId: 'asc' }, { startBab: 'asc' }]
		});

		// Ali held 16 and 18, not 16–18: 17 was Ayşe's, and his record must not claim it.
		expect(releases).toEqual([
			{ userId: ALI, startBab: FIRST, endBab: FIRST, roundIndex: ROUND_INDEX },
			{ userId: ALI, startBab: THIRD, endBab: THIRD, roundIndex: ROUND_INDEX },
			{ userId: AYSE, startBab: SECOND, endBab: SECOND, roundIndex: ROUND_INDEX }
		]);
	});

	it('files each claimant’s own inbox rows and pushes each their own range', async () => {
		const group = await setUp();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		const rows = await prisma.notification.findMany({
			where: { groupId: group.id, kind: 'POOL_CLAIM_RELEASED' },
			select: { userId: true, payload: true }
		});

		expect(rows.filter(row => row.userId === ALI).map(row => row.payload)).toEqual(
			expect.arrayContaining([
				{ startBab: FIRST, endBab: FIRST },
				{ startBab: THIRD, endBab: THIRD }
			])
		);
		expect(rows.filter(row => row.userId === AYSE).map(row => row.payload)).toEqual([
			{ startBab: SECOND, endBab: SECOND }
		]);

		expect(sendPushToUser).toHaveBeenCalledWith(
			ALI,
			expect.objectContaining({ body: expect.stringContaining(`Portions ${FIRST}, ${THIRD} became`) })
		);
		expect(sendPushToUser).toHaveBeenCalledWith(
			AYSE,
			expect.objectContaining({ body: expect.stringContaining(`Portion ${SECOND} became`) })
		);
	});

	it('leaves the reads already made where they are', async () => {
		const group = await setUp();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		expect((await babAt(group.id, FIRST)).readByUserId).toBe(ALI);
		expect(await prisma.babRead.count({ where: { groupId: group.id, babNumber: FIRST, userId: ALI } })).toBe(1);
	});
});

describe('a portion taken while somebody joins that seat', () => {
	/*
	 * Both paths take the group lock first, so one runs wholly before the other: either the
	 * take lands and the join releases it with a record, or the join lands and the take finds
	 * the seat filled. What must never happen is a claim left on a block that is no longer
	 * pool, or a claim cleared with no record that it existed.
	 */
	it('either releases the claim with a record, or refuses it', async () => {
		for (let attempt = 0; attempt < 5; attempt++) {
			await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
			const group = await createGroup();

			const [, take] = await Promise.allSettled([
				joinGroupForUser(JOINER, 'Joiner', group.id),
				takePoolPartForUser(ALI, group.id, FIRST)
			]);

			expect((await babAt(group.id, FIRST)).assignedUserId).toBeNull();
			expect(await prisma.poolClaimRelease.count({ where: { groupId: group.id, userId: ALI } })).toBe(
				take.status === 'fulfilled' ? 1 : 0
			);

			if (take.status === 'rejected') {
				expect(take.reason).toMatchObject({ statusCode: 400 });
			}
		}
	});
});

describe('releasePoolPartForUser', () => {
	/** A finished round in which Ali and Ayşe each took and read one portion of the pool block. */
	const createFinishedRound = async () => {
		const group = await createGroup();
		await takePoolPartForUser(ALI, group.id, FIRST);
		await takePoolPartForUser(AYSE, group.id, SECOND);

		await prisma.groupBab.updateMany({
			where: { groupId: group.id },
			data: { readByUserId: OWNER, readAt: new Date() }
		});
		await prisma.groupBab.update({
			where: { groupId_number: { groupId: group.id, number: FIRST } },
			data: { readByUserId: ALI }
		});
		await prisma.groupBab.update({
			where: { groupId_number: { groupId: group.id, number: SECOND } },
			data: { readByUserId: AYSE }
		});
		await prisma.babRead.createMany({
			data: [
				{ groupId: group.id, babNumber: FIRST, userId: ALI, roundIndex: ROUND_INDEX },
				{ groupId: group.id, babNumber: SECOND, userId: AYSE, roundIndex: ROUND_INDEX }
			]
		});
		await prisma.group.update({ where: { id: group.id }, data: { completedAt: new Date() } });

		return group;
	};

	it('gives the portion back and takes the releaser’s read of it with it', async () => {
		const group = await createFinishedRound();

		await releasePoolPartForUser(ALI, group.id, FIRST);

		const bab = await babAt(group.id, FIRST);

		expect(bab.assignedUserId).toBeNull();
		expect(bab.readByUserId).toBeNull();
		expect(bab.readAt).toBeNull();
		expect(await prisma.babRead.count({ where: { groupId: group.id, babNumber: FIRST } })).toBe(0);
	});

	it('leaves another member’s portion of the same block alone', async () => {
		const group = await createFinishedRound();

		await releasePoolPartForUser(ALI, group.id, FIRST);

		const bab = await babAt(group.id, SECOND);

		expect(bab.assignedUserId).toBe(AYSE);
		expect(bab.readByUserId).toBe(AYSE);
		expect(await prisma.babRead.count({ where: { groupId: group.id, babNumber: SECOND, userId: AYSE } })).toBe(1);
	});

	it('reopens a round the released read had finished', async () => {
		const group = await createFinishedRound();

		await releasePoolPartForUser(ALI, group.id, FIRST);

		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).completedAt).toBeNull();
	});

	it('does nothing to a portion the caller did not take', async () => {
		const group = await createFinishedRound();

		await expect(releasePoolPartForUser(ALI, group.id, SECOND)).resolves.toEqual({ success: true });

		expect((await babAt(group.id, SECOND)).assignedUserId).toBe(AYSE);
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).completedAt).not.toBeNull();
	});

	it('refuses a Cevşen group', async () => {
		const group = await createGroup({ kind: 'CEVSEN' });

		await expect(releasePoolPartForUser(ALI, group.id, 95)).rejects.toMatchObject({ statusCode: 400 });
	});
});
