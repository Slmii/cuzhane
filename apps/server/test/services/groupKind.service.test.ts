import prisma from '@db/prisma';
import { setBabReadForUser } from '@services/babs.service';
import { createGroupForUser } from '@services/groups.service';
import { getProfileStatsForUser } from '@services/profile.service';
import { coverMissedBabsForUser, getRoundDetailForUser, listRoundsForUser } from '@services/roundHistory.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, roundIndexSince, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

/*
 * Clerk is not what these tests are about, and the create path looks every member up there.
 * Answering with no profiles makes every name fall back to the stored one, which is exactly
 * what the lookup does when Clerk is unreachable.
 */
vi.mock('@utils/memberProfiles', async () => {
	const actual = await vi.importActual<typeof import('@utils/memberProfiles')>('@utils/memberProfiles');

	return { ...actual, getMemberProfiles: async () => new Map() };
});

const OWNER = 'test_owner';
/** Eleven seats over the Hizb's 33 portions: three apiece, no remainder. */
const HIZB_SPOTS = 11;

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

let codeCounter = 0;
/** Unique within a test; the table is truncated between them. */
const nextInviteCode = () => `KIND${String(codeCounter++).padStart(4, '0')}`;

/** A running group with the owner in seat 0, on the round its start date implies. */
const createRunningGroup = async ({
	kind = 'HIZB' as 'CEVSEN' | 'HIZB',
	spots = HIZB_SPOTS,
	startedDaysAgo = 3
} = {}) => {
	const startedAt = daysAgo(startedDaysAgo);
	const partCount = kind === 'HIZB' ? 33 : 100;

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: `${kind} Halkası`,
			inviteCode: nextInviteCode(),
			kind,
			spots,
			cycle: 'DAILY',
			splitMode: 'ROTATION',
			status: 'RUNNING',
			startedAt,
			roundIndex: roundIndexSince(startedAt, 'DAILY', new Date(), DEFAULT_TIME_ZONE),
			roundStartedAt: startedAt,
			timezone: DEFAULT_TIME_ZONE,
			members: {
				create: [{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0, joinedAt: startedAt }]
			}
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: partCount }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});

	return group;
};

const recordHistory = (groupId: string, roundIndex: number, babNumbers: number[], userId = OWNER) =>
	prisma.babRead.createMany({
		data: babNumbers.map(babNumber => ({ babNumber, groupId, roundIndex, userId }))
	});

const numbersUpTo = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('createGroupForUser', () => {
	const input = {
		name: 'Hizb Halkası',
		visibility: 'OPEN' as const,
		splitMode: 'ROTATION' as const,
		reminderEnabled: true,
		reminderTime: '21:30',
		timezone: DEFAULT_TIME_ZONE
	};

	it('gives a Hizb group its 33 portions and says so', async () => {
		const detail = await createGroupForUser(OWNER, 'Owner', {
			...input,
			kind: 'HIZB',
			spots: HIZB_SPOTS,
			cycle: 'MONTHLY'
		});

		expect(await prisma.groupBab.count({ where: { groupId: detail.id } })).toBe(33);
		expect(detail.kind).toBe('HIZB');
		expect(detail.partCount).toBe(33);
		expect(detail.cycle).toBe('MONTHLY');
		// Seat 0's reserved block is its third of the 33, not a tenth of a hundred.
		expect(detail.myBabNumbers).toEqual([1, 2, 3]);
	});

	it('still gives a Cevşen group its hundred babs', async () => {
		const detail = await createGroupForUser(OWNER, 'Owner', {
			...input,
			kind: 'CEVSEN',
			spots: 20,
			cycle: 'WEEKLY'
		});

		expect(await prisma.groupBab.count({ where: { groupId: detail.id } })).toBe(100);
		expect(detail.kind).toBe('CEVSEN');
		expect(detail.partCount).toBe(100);
		expect(detail.myBabNumbers).toEqual([1, 2, 3, 4, 5]);
	});
});

describe('setBabReadForUser on a Hizb group', () => {
	it('refuses a part past the 33rd as a bad request', async () => {
		const group = await createRunningGroup({ startedDaysAgo: 0 });

		await expect(setBabReadForUser(OWNER, group.id, 34, true)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('marks a part in the caller’s share', async () => {
		const group = await createRunningGroup({ startedDaysAgo: 0 });

		const bab = await setBabReadForUser(OWNER, group.id, 2, true);

		expect(bab.number).toBe(2);
		expect(bab.readByUserId).toBe(OWNER);
	});
});

describe('round history of a Hizb group', () => {
	it('counts a closed round’s misses out of 33', async () => {
		const group = await createRunningGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [4, 5, 6, 7, 8]);

		const round1 = (await listRoundsForUser(OWNER, group.id)).find(round => round.roundIndex === 1);

		expect(round1?.partCount).toBe(33);
		expect(round1?.readCount).toBe(5);
		expect(round1?.missedCount).toBe(28);
		// Eleven seats over 33 parts: the owner owes three a round, never a tenth of a hundred.
		expect(round1?.myOwedCount).toBe(3);
	});

	it('lists 33 parts in a round’s detail, each owed by the seat that held it', async () => {
		const group = await createRunningGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [4, 5, 6, 7, 8]);

		const detail = await getRoundDetailForUser(OWNER, group.id, 1);

		expect(detail.partCount).toBe(33);
		expect(detail.babs.map(bab => bab.number)).toEqual(numbersUpTo(33));
		expect(detail.readCount).toBe(5);
		expect(detail.missedCount).toBe(28);
		// Block 1 is parts 4–6. In round 1 the seat reading it is seat 0 — the rotation run
		// backwards over a 33-part division, not a 100-bab one.
		expect(detail.babs.find(bab => bab.number === 4)?.owedBySlotIndex).toBe(0);
		expect(detail.babs.find(bab => bab.number === 1)?.owedBySlotIndex).toBe(10);
	});

	it('refuses to cover a part the Hizb does not have', async () => {
		const group = await createRunningGroup({ startedDaysAgo: 3 });

		await expect(coverMissedBabsForUser(OWNER, group.id, 1, [34])).rejects.toMatchObject({ statusCode: 404 });
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(0);
	});
});

describe('getProfileStatsForUser across kinds', () => {
	it('counts a fully read Hizb round as completed', async () => {
		const group = await createRunningGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, numbersUpTo(33));

		expect((await getProfileStatsForUser(OWNER)).roundsCompleted).toBe(1);
	});

	it('still counts a fully read Cevşen round, and not a Cevşen round a third read', async () => {
		const full = await createRunningGroup({ kind: 'CEVSEN', spots: 20, startedDaysAgo: 3 });
		const partial = await createRunningGroup({ kind: 'CEVSEN', spots: 20, startedDaysAgo: 3 });
		await recordHistory(full.id, 1, numbersUpTo(100));
		await recordHistory(partial.id, 1, numbersUpTo(33));

		expect((await getProfileStatsForUser(OWNER)).roundsCompleted).toBe(1);
	});

	it('keeps Hizb reads out of the bab total, but in the reading days', async () => {
		const cevsen = await createRunningGroup({ kind: 'CEVSEN', spots: 20, startedDaysAgo: 3 });
		const hizb = await createRunningGroup({ startedDaysAgo: 3 });
		await recordHistory(cevsen.id, 1, [1, 2, 3]);
		await recordHistory(hizb.id, 1, [1, 2]);

		const stats = await getProfileStatsForUser(OWNER);

		expect(stats.babsRead).toBe(3);
		// Every read in `recordHistory` lands now, so today's square counts all five.
		expect(stats.last30Days[stats.last30Days.length - 1]?.count).toBe(5);
		expect(stats.streakDays).toBe(1);
	});
});
