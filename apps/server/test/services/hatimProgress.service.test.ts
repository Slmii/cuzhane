import prisma from '@db/prisma';
import { getMyProgressForUser } from '@services/roundHistory.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, startOfCivilDay } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const LATE = 'test_late';
const ROUND_DAYS = 7;

const daysAgo = (days: number): Date =>
	startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE) - days, DEFAULT_TIME_ZONE);

/**
 * A weekly hatim two weeks in, so round 2 is open and rounds 0 and 1 are closed. The owner
 * has been there from the start; the second member joined a week in, at round 1.
 */
const createHatim = async () => {
	const startedAt = daysAgo(ROUND_DAYS * 2);

	const group = await prisma.group.create({
		data: {
			boundaryPolicy: 'REPICK',
			cycle: 'WEEKLY',
			distribution: 'FREE_PICK',
			inviteCode: `Q${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind: 'HATIM',
			name: 'İlerleme Hatmi',
			ownerUserId: OWNER,
			roundDays: ROUND_DAYS,
			roundIndex: 2,
			roundStartedAt: daysAgo(0),
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
			{
				displayName: 'Owner',
				groupId: group.id,
				joinedAt: startedAt,
				role: 'OWNER',
				slotIndex: 0,
				userId: OWNER
			},
			{
				displayName: 'Late',
				groupId: group.id,
				joinedAt: daysAgo(ROUND_DAYS),
				role: 'MEMBER',
				slotIndex: 1,
				userId: LATE
			}
		]
	});

	return group;
};

const hold = (groupId: string, userId: string, roundIndex: number, cuzNumber: number, isLoan = false) =>
	prisma.cuzHolding.create({ data: { cuzNumber, groupId, isLoan, roundIndex, userId } });

const read = (groupId: string, userId: string, roundIndex: number, cuzNumber: number) =>
	prisma.babRead.create({ data: { babNumber: cuzNumber, groupId, roundIndex, userId } });

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

describe('Senin ilerlemen for a hatim (Q6)', () => {
	it('owes each round exactly the cüz held in it — loans included — and reports each one', async () => {
		const group = await createHatim();

		// Round 0: both read. Round 1: 3 read, 15 missed, 20 a loan from the havuz and read.
		// Round 2, open: 7 read, 22 not yet.
		await hold(group.id, OWNER, 0, 9);
		await hold(group.id, OWNER, 0, 30);
		await hold(group.id, OWNER, 1, 3);
		await hold(group.id, OWNER, 1, 15);
		await hold(group.id, OWNER, 1, 20, true);
		await hold(group.id, OWNER, 2, 7);
		await hold(group.id, OWNER, 2, 22);
		await read(group.id, OWNER, 0, 9);
		await read(group.id, OWNER, 0, 30);
		await read(group.id, OWNER, 1, 3);
		await read(group.id, OWNER, 1, 20);
		await read(group.id, OWNER, 2, 7);

		const progress = await getMyProgressForUser(OWNER, group.id);

		expect(
			progress.periods.map(period => ({
				isOpen: period.isOpen,
				missed: period.missedBabs.map(missed => missed.babNumber),
				owedCount: period.owedCount,
				readCount: period.readCount,
				roundIndex: period.roundIndex,
				units: period.units
			}))
		).toEqual([
			{
				isOpen: false,
				missed: [],
				owedCount: 2,
				readCount: 2,
				roundIndex: 0,
				units: [
					{ isRead: true, number: 9 },
					{ isRead: true, number: 30 }
				]
			},
			{
				isOpen: false,
				missed: [15],
				owedCount: 3,
				readCount: 2,
				roundIndex: 1,
				units: [
					{ isRead: true, number: 3 },
					{ isRead: false, number: 15 },
					{ isRead: true, number: 20 }
				]
			},
			{
				isOpen: true,
				missed: [],
				owedCount: 2,
				readCount: 1,
				roundIndex: 2,
				units: [
					{ isRead: true, number: 7 },
					{ isRead: false, number: 22 }
				]
			}
		]);
		expect(progress).toMatchObject({ missedCount: 1, owedCount: 7, ratePercent: 71, readCount: 5 });
	});

	it('does not count the rounds before a member joined against them', async () => {
		const group = await createHatim();

		// Round 0's cüz 5 was held by the owner, before the late member had a seat.
		await hold(group.id, OWNER, 0, 5);
		await hold(group.id, LATE, 1, 5);

		const progress = await getMyProgressForUser(LATE, group.id);

		expect(progress.periods.map(period => period.roundIndex)).toEqual([1, 2]);
		expect(progress.periods[0]?.missedBabs).toEqual([{ babNumber: 5, roundIndex: 1 }]);
		// Holding nothing this round is an empty row, not a failure.
		expect(progress.periods[1]).toMatchObject({ owedCount: 0, units: [] });
	});

	it('keeps a one-off hatim’s only round for someone who joined after its first stretch', async () => {
		// "Tek seferlik": seven days a round, but the group never leaves round 0. Joined on day
		// ten, the member's join floor would be round 1 — past the only round there is.
		const startedAt = daysAgo(10);
		const group = await prisma.group.create({
			data: {
				cycle: 'CUSTOM',
				distribution: 'FREE_PICK',
				inviteCode: `C${Math.floor(performance.now() * 1000)
					.toString(36)
					.toUpperCase()
					.slice(-7)}`,
				kind: 'HATIM',
				name: 'Tek Seferlik',
				ownerUserId: OWNER,
				roundDays: ROUND_DAYS,
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

		await prisma.groupMember.create({
			data: {
				displayName: 'Late',
				groupId: group.id,
				joinedAt: daysAgo(0),
				role: 'MEMBER',
				slotIndex: 0,
				userId: LATE
			}
		});
		await hold(group.id, LATE, 0, 12);

		const progress = await getMyProgressForUser(LATE, group.id);

		expect(progress.periods.map(period => period.roundIndex)).toEqual([0]);
		expect(progress.periods[0]?.units).toEqual([{ isRead: false, number: 12 }]);
	});
});
