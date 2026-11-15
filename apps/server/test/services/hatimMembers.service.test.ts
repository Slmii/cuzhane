import prisma from '@db/prisma';
import { getGroupDetailForUser } from '@services/groups.service';
import { listMembersForUser } from '@services/groupMembership.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, startOfCivilDay } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const MEMBER = 'test_member';
const ROUND_DAYS = 7;

const daysAgo = (days: number): Date =>
	startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE) - days, DEFAULT_TIME_ZONE);

/** A weekly hatim in its first round, two members, nothing held yet. */
const createHatim = async () => {
	const startedAt = daysAgo(1);

	const group = await prisma.group.create({
		data: {
			boundaryPolicy: 'REPICK',
			cycle: 'WEEKLY',
			distribution: 'FREE_PICK',
			inviteCode: `M${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind: 'HATIM',
			name: 'Üyeler Hatmi',
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
				displayName: 'Member',
				groupId: group.id,
				joinedAt: startedAt,
				role: 'MEMBER',
				slotIndex: 1,
				userId: MEMBER
			}
		]
	});

	return group;
};

const hold = (groupId: string, userId: string, cuzNumber: number) =>
	prisma.cuzHolding.create({ data: { cuzNumber, groupId, roundIndex: 0, userId } });

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

/*
 * A hatim member's numbers are the cüz they hold this round, not a block the Cevşen's seat
 * maths would derive from their seat: at thirty seats that maths hands seat 1 a slice of a
 * hundred, which names no cüz anyone holds and always reads 0%.
 */
describe('a hatim member list names the cüz each member holds', () => {
	it('in the members list', async () => {
		const group = await createHatim();

		await hold(group.id, OWNER, 3);
		await hold(group.id, MEMBER, 25);
		await hold(group.id, MEMBER, 17);
		await prisma.groupBab.updateMany({
			data: { readAt: new Date(), readByUserId: MEMBER },
			where: { groupId: group.id, number: 17 }
		});

		const members = await listMembersForUser(OWNER, group.id);
		const byUser = new Map(members.map(member => [member.userId, member]));

		expect(byUser.get(OWNER)?.babNumbers).toEqual([3]);
		expect(byUser.get(MEMBER)?.babNumbers).toEqual([17, 25]);
		expect(byUser.get(MEMBER)?.readCount).toBe(1);
	});

	it('in the group detail', async () => {
		const group = await createHatim();

		await hold(group.id, MEMBER, 9);

		const detail = await getGroupDetailForUser(OWNER, group.id);
		const byUser = new Map(detail.members.map(member => [member.userId, member]));

		expect(byUser.get(MEMBER)?.babNumbers).toEqual([9]);
		// Holding nothing this round is holding nothing — not a seat's block.
		expect(byUser.get(OWNER)?.babNumbers).toEqual([]);
	});
});
