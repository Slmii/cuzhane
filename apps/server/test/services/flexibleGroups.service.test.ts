import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { createGroupForUser, getGroupDetailForUser, updateGroupForUser } from '@services/groups.service';
import { joinGroupForUser, leaveGroupForUser } from '@services/groupMembership.service';
import { takePoolPartForUser, releasePoolPartForUser, releasePoolSlotForUser } from '@services/pool.service';
import { setBabReadForUser } from '@services/babs.service';
import { getMyProgressForUser, getRoundDetailForUser } from '@services/roundHistory.service';
import { ensureCurrentRoundFor } from '@services/rounds.service';
import { setPartRepetitionsForUser } from '@services/repetitions.service';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'flex_owner';
const READER = 'flex_reader';
const create = () =>
	createGroupForUser(
		OWNER,
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Read together',
			visibility: 'OPEN',
			splitMode: 'FLEXIBLE',
			spots: 5,
			cycle: 'DAILY',
			reminderTime: '21:00',
			timezone: 'Europe/Amsterdam'
		})
	);

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});
afterAll(async () => {
	await prisma.$disconnect();
});

describe('open flexible groups', () => {
	it('starts immediately with no assigned share or full state', async () => {
		const group = await create();
		expect(group.splitMode).toBe('FLEXIBLE');
		expect(group.status).toBe('RUNNING');
		expect(group.myBabNumbers).toEqual([]);
		expect(group.myRoundRange).toBeNull();
		expect(group.poolBabNumbers).toHaveLength(100);
		expect(group.isFull).toBe(false);
	});

	it('allows more members than there are portions without changing existing claims', async () => {
		const group = await create();
		await takePoolPartForUser(OWNER, group.id, 1);
		await prisma.groupMember.createMany({
			data: Array.from({ length: 105 }, (_, i) => ({
				groupId: group.id,
				userId: `flex_${i}`,
				displayName: `Member ${i}`,
				slotIndex: i + 1
			}))
		});
		const joined = await joinGroupForUser(READER, 'Reader', group.id);
		expect(joined.memberCount).toBe(107);
		expect(joined.isFull).toBe(false);
		expect(joined.myBabNumbers).toEqual([]);
		expect(joined.babs[0]?.assignedUserId).toBe(OWNER);
	});

	it('permits only one volunteer per portion and only that volunteer can mark it', async () => {
		const group = await create();
		await joinGroupForUser(READER, 'Reader', group.id);
		const claims = await Promise.allSettled([
			takePoolPartForUser(OWNER, group.id, 2),
			takePoolPartForUser(READER, group.id, 2)
		]);
		expect(claims.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		const bab = await prisma.groupBab.findUniqueOrThrow({
			where: { groupId_number: { groupId: group.id, number: 2 } }
		});
		const winner = bab.assignedUserId!;
		const loser = winner === OWNER ? READER : OWNER;
		await expect(setBabReadForUser(loser, group.id, 2, true)).rejects.toThrow();
		await setBabReadForUser(winner, group.id, 2, true);
		expect((await getGroupDetailForUser(winner, group.id)).readCount).toBe(1);
	});

	it('keeps completed reading and frees unread claims when a member leaves', async () => {
		const group = await create();
		await joinGroupForUser(READER, 'Reader', group.id);
		await takePoolPartForUser(READER, group.id, 1);
		await takePoolPartForUser(READER, group.id, 2);
		await setBabReadForUser(READER, group.id, 1, true);
		await leaveGroupForUser(READER, group.id);
		const detail = await getGroupDetailForUser(OWNER, group.id);
		expect(detail.babs[0]?.readByUserId).toBe(READER);
		expect(detail.babs[1]?.assignedUserId).toBeNull();
		expect(await prisma.babRead.count({ where: { groupId: group.id, userId: READER } })).toBe(1);
		await expect(takePoolPartForUser(OWNER, group.id, 1)).rejects.toThrow();
	});

	it('transfers ownership on departure and lets an empty group be joined again', async () => {
		const group = await create();
		await joinGroupForUser(READER, 'Reader', group.id);
		await leaveGroupForUser(OWNER, group.id);
		expect((await getGroupDetailForUser(READER, group.id)).isOwner).toBe(true);
		await leaveGroupForUser(READER, group.id);
		const rejoined = await joinGroupForUser(OWNER, 'Owner', group.id);
		expect(rejoined.isOwner).toBe(true);
	});

	it('does not assign missed work or let an owner close a flexible group', async () => {
		const group = await create();
		expect((await getMyProgressForUser(OWNER, group.id)).owedCount).toBe(0);
		const round = await getRoundDetailForUser(OWNER, group.id, 0);
		expect(round.babs.every(bab => bab.owedByUserId === null)).toBe(true);
		await expect(updateGroupForUser(OWNER, group.id, { openToJoin: false })).rejects.toThrow();
		await expect(updateGroupForUser(OWNER, group.id, { visibility: 'PRIVATE' })).rejects.toThrow();
	});

	it('releases unread portions without removing completed history', async () => {
		const group = await create();
		await takePoolPartForUser(OWNER, group.id, 1);
		await takePoolPartForUser(OWNER, group.id, 2);
		await setBabReadForUser(OWNER, group.id, 1, true);
		await releasePoolPartForUser(OWNER, group.id, 1);
		await releasePoolPartForUser(OWNER, group.id, 2);
		await expect(releasePoolSlotForUser(OWNER, group.id, 0)).rejects.toThrow();
		const detail = await getGroupDetailForUser(OWNER, group.id);
		expect(detail.babs[0]?.readAt).not.toBeNull();
		expect(detail.babs[1]?.assignedUserId).toBeNull();
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(1);
	});

	it('rolls the pool over without assigning missed work to members', async () => {
		const group = await create();
		await takePoolPartForUser(OWNER, group.id, 1);
		await setBabReadForUser(OWNER, group.id, 1, true);
		const oldStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
		await prisma.group.update({ where: { id: group.id }, data: { startedAt: oldStart, roundStartedAt: oldStart } });
		await ensureCurrentRoundFor(group.id);
		const detail = await getGroupDetailForUser(OWNER, group.id);
		expect(detail.readCount).toBe(0);
		expect(detail.myBabNumbers).toEqual([]);
		expect((await getMyProgressForUser(OWNER, group.id)).missedCount).toBe(0);
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(1);
	});

	it('keeps required Hizb repetitions before marking a volunteered portion', async () => {
		const group = await createGroupForUser(
			OWNER,
			'Owner',
			CreateGroupBodySchema.parse({
				name: 'Flexible Hizb',
				kind: 'HIZB',
				splitMode: 'FLEXIBLE',
				cycle: 'WEEKLY',
				reminderTime: '21:00'
			})
		);
		await takePoolPartForUser(OWNER, group.id, 19);
		await expect(setBabReadForUser(OWNER, group.id, 19, true)).rejects.toThrow();
		await setPartRepetitionsForUser(OWNER, group.id, 19, { count: 19 });
		await setBabReadForUser(OWNER, group.id, 19, true);
		expect((await getGroupDetailForUser(OWNER, group.id)).readCount).toBe(1);
	});
});
