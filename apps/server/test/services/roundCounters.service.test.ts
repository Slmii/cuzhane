import prisma from '@db/prisma';
import { deleteAccountForUser } from '@services/account.service';
import { getRoundCountersForUser, setRoundCountersForUser } from '@services/roundCounters.service';
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
const STRANGER = 'test_stranger';

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

let codeCounter = 0;
const nextInviteCode = () => `CNTR${String(codeCounter++).padStart(4, '0')}`;

/**
 * A running seat-divided Hizb group on the round its start date implies — unless `isBehind`, in
 * which case the stored round is one short and the first request that touches it rolls it over.
 */
const createGroup = async ({
	kind = 'HIZB' as 'CEVSEN' | 'HIZB',
	status = 'RUNNING' as 'RUNNING' | 'GATHERING',
	hizbPlan = null as number | null,
	startedDaysAgo = 0,
	isBehind = false
} = {}) => {
	const startedAt = daysAgo(startedDaysAgo);
	const roundIndex = roundIndexSince(startedAt, 1, new Date(), DEFAULT_TIME_ZONE) - (isBehind ? 1 : 0);
	const isRunning = status === 'RUNNING';

	return prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: `${kind} Halkası`,
			inviteCode: nextInviteCode(),
			kind,
			spots: 11,
			cycle: 'DAILY',
			roundDays: 1,
			splitMode: 'FIXED',
			hizbPlan,
			status,
			startedAt: isRunning ? startedAt : null,
			roundIndex: isRunning ? roundIndex : 0,
			roundStartedAt: isRunning ? startedAt : null,
			timezone: DEFAULT_TIME_ZONE,
			members: {
				create: [
					{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 6, joinedAt: startedAt },
					{ userId: OTHER, displayName: 'Other', role: 'MEMBER', slotIndex: 0, joinedAt: startedAt }
				]
			}
		}
	});
};

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('setRoundCountersForUser / getRoundCountersForUser', () => {
	it('starts at nothing counted, with the istighfar’s usual eleven', async () => {
		const group = await createGroup();

		expect(await getRoundCountersForUser(OWNER, group.id)).toEqual({
			delailCount: 0,
			istighfarCount: 0,
			istighfarTarget: 11,
			roundIndex: group.roundIndex
		});
	});

	it('keeps what was counted, so a reader who comes back finds it', async () => {
		const group = await createGroup();

		await setRoundCountersForUser(OWNER, group.id, { delailCount: 2 });
		await setRoundCountersForUser(OWNER, group.id, { istighfarCount: 7, istighfarTarget: 33 });

		expect(await getRoundCountersForUser(OWNER, group.id)).toEqual({
			delailCount: 2,
			istighfarCount: 7,
			istighfarTarget: 33,
			roundIndex: group.roundIndex
		});
	});

	it('stores an absolute count, so a retried PUT changes nothing', async () => {
		const group = await createGroup();

		await setRoundCountersForUser(OWNER, group.id, { delailCount: 1 });
		await setRoundCountersForUser(OWNER, group.id, { delailCount: 1 });

		expect((await getRoundCountersForUser(OWNER, group.id)).delailCount).toBe(1);
	});

	it('keeps each reader’s counts their own', async () => {
		const group = await createGroup();

		await setRoundCountersForUser(OTHER, group.id, { delailCount: 3, istighfarCount: 11 });

		expect(await getRoundCountersForUser(OWNER, group.id)).toMatchObject({ delailCount: 0, istighfarCount: 0 });
	});

	it('refuses more than each count allows', async () => {
		const group = await createGroup();

		await expect(setRoundCountersForUser(OWNER, group.id, { delailCount: 4 })).rejects.toMatchObject({
			statusCode: 400
		});
		await expect(setRoundCountersForUser(OWNER, group.id, { istighfarCount: 101 })).rejects.toMatchObject({
			statusCode: 400
		});
		await expect(setRoundCountersForUser(OWNER, group.id, { istighfarTarget: 101 })).rejects.toMatchObject({
			statusCode: 400
		});
		expect(await prisma.groupRoundCounter.count()).toBe(0);
	});

	it('refuses a group that has no such counters: a Cevşen, or a Hizb read on personal plans', async () => {
		const cevsen = await createGroup({ kind: 'CEVSEN' });
		const plan = await createGroup({ hizbPlan: 32 });

		await expect(getRoundCountersForUser(OWNER, cevsen.id)).rejects.toMatchObject({ statusCode: 400 });
		await expect(setRoundCountersForUser(OWNER, plan.id, { delailCount: 1 })).rejects.toMatchObject({
			statusCode: 400
		});
	});

	it('refuses a group that has not started', async () => {
		const group = await createGroup({ status: 'GATHERING' });

		await expect(setRoundCountersForUser(OWNER, group.id, { delailCount: 1 })).rejects.toMatchObject({
			statusCode: 400
		});
	});

	it('refuses a round the group has not reached', async () => {
		const group = await createGroup();

		await expect(getRoundCountersForUser(OWNER, group.id, group.roundIndex + 1)).rejects.toMatchObject({
			statusCode: 400
		});
	});

	it('refuses a non-member, reading or writing', async () => {
		const group = await createGroup();

		await expect(getRoundCountersForUser(STRANGER, group.id)).rejects.toHaveProperty('statusCode');
		await expect(setRoundCountersForUser(STRANGER, group.id, { delailCount: 1 })).rejects.toHaveProperty(
			'statusCode'
		);
		expect(await prisma.groupRoundCounter.count()).toBe(0);
	});
});

describe('counting across a round boundary', () => {
	it('starts a new round with nothing counted', async () => {
		const group = await createGroup({ startedDaysAgo: 1, isBehind: true });
		const leftRound = group.roundIndex;

		await prisma.groupRoundCounter.create({
			data: { groupId: group.id, userId: OWNER, roundIndex: leftRound, delailCount: 3 }
		});

		// The read rolls the group first, into a round nobody has counted in yet.
		expect(await getRoundCountersForUser(OWNER, group.id)).toMatchObject({
			delailCount: 0,
			roundIndex: leftRound + 1
		});
		expect(await getRoundCountersForUser(OWNER, group.id, leftRound)).toMatchObject({ delailCount: 3 });
	});

	it('refuses a count meant for the open round once that round has closed', async () => {
		const group = await createGroup({ startedDaysAgo: 1, isBehind: true });

		await expect(
			setRoundCountersForUser(OWNER, group.id, {
				delailCount: 2,
				isOpenRound: true,
				roundIndex: group.roundIndex
			})
		).rejects.toMatchObject({ statusCode: 409 });
		expect(await prisma.groupRoundCounter.count()).toBe(0);
	});

	it('still lets a closed round be counted on purpose, for covering it', async () => {
		const group = await createGroup({ startedDaysAgo: 1, isBehind: true });

		expect(
			await setRoundCountersForUser(OWNER, group.id, { delailCount: 2, roundIndex: group.roundIndex })
		).toMatchObject({ delailCount: 2, roundIndex: group.roundIndex });
	});
});

describe('deleting an account', () => {
	it('takes the member’s counts with it, and leaves everyone else’s', async () => {
		const group = await createGroup();
		await setRoundCountersForUser(OWNER, group.id, { delailCount: 1 });
		await setRoundCountersForUser(OTHER, group.id, { delailCount: 2 });

		await deleteAccountForUser(OTHER);

		expect(await prisma.groupRoundCounter.count({ where: { userId: OTHER } })).toBe(0);
		expect(await prisma.groupRoundCounter.count({ where: { userId: OWNER } })).toBe(1);
	});
});
