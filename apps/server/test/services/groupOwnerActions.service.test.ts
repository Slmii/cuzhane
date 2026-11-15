import prisma from '@db/prisma';
import { removeMemberForUser } from '@services/groupMembership.service';
import { startGroupForUser } from '@services/groups.service';
import { DEFAULT_TIME_ZONE } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'owner';
const MEMBER = 'member';
const OTHER = 'other';

let codes = 0;

const createGroup = async (kind: 'CEVSEN' | 'HATIM', status: 'GATHERING' | 'RUNNING') => {
	const unitCount = kind === 'HATIM' ? CUZ_COUNT : 100;
	const running = status === 'RUNNING';
	const group = await prisma.group.create({
		data: {
			...(kind === 'HATIM' ? { boundaryPolicy: 'KEEP' as const, distribution: 'FREE_PICK' as const } : {}),
			cycle: 'DAILY',
			inviteCode: `O${String(++codes).padStart(7, '0')}`,
			kind,
			name: 'Owner Hatmi',
			ownerUserId: OWNER,
			roundDays: 1,
			roundIndex: 0,
			spots: kind === 'HATIM' ? CUZ_COUNT : 10,
			splitMode: 'FIXED',
			startsAt: new Date(),
			status,
			timezone: DEFAULT_TIME_ZONE,
			...(running ? { roundStartedAt: new Date(), startedAt: new Date() } : {})
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: unitCount }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});
	await prisma.groupMember.createMany({
		data: [
			{ displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER },
			{ displayName: 'Member', groupId: group.id, role: 'MEMBER', slotIndex: 1, userId: MEMBER },
			{ displayName: 'Other', groupId: group.id, role: 'MEMBER', slotIndex: 2, userId: OTHER }
		]
	});

	return group;
};

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
	await prisma.notification.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('starting a gathering group', () => {
	it('is the owner’s alone', async () => {
		const group = await createGroup('CEVSEN', 'GATHERING');

		await expect(startGroupForUser(MEMBER, group.id)).rejects.toMatchObject({ statusCode: 403 });
		// A stranger does not learn the group exists.
		await expect(startGroupForUser('stranger', group.id)).rejects.toMatchObject({ statusCode: 404 });
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).status).toBe('GATHERING');
	});

	it('opens round 0 once, with a start, and refuses a group already running', async () => {
		const group = await createGroup('CEVSEN', 'GATHERING');

		const detail = await startGroupForUser(OWNER, group.id);

		expect(detail.status).toBe('RUNNING');
		const started = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
		expect(started).toMatchObject({ roundIndex: 0, status: 'RUNNING' });
		expect(started.startedAt).not.toBeNull();
		expect(started.roundStartedAt).toEqual(started.startedAt);
		await expect(startGroupForUser(OWNER, group.id)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('lets exactly one of two concurrent starts through', async () => {
		const group = await createGroup('CEVSEN', 'GATHERING');

		const results = await Promise.allSettled([
			startGroupForUser(OWNER, group.id),
			startGroupForUser(OWNER, group.id)
		]);

		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).status).toBe('RUNNING');
	});
});

describe('removing a member', () => {
	it('is the owner’s alone, and never removes the owner', async () => {
		const group = await createGroup('CEVSEN', 'RUNNING');

		await expect(removeMemberForUser(MEMBER, group.id, OTHER)).rejects.toMatchObject({ statusCode: 403 });
		await expect(removeMemberForUser(OWNER, group.id, OWNER)).rejects.toMatchObject({ statusCode: 400 });
		await expect(removeMemberForUser(OWNER, group.id, 'stranger')).rejects.toMatchObject({ statusCode: 404 });
		expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(3);
	});

	it('frees the seat and the pool claim, keeps the reads, and stamps a board that is now whole', async () => {
		const group = await createGroup('CEVSEN', 'RUNNING');
		// Every bab read, the member's among them, and the stamp missing — which only the
		// read-state sweep may put right.
		await prisma.groupBab.updateMany({
			where: { groupId: group.id },
			data: { readAt: new Date(), readByUserId: OWNER }
		});
		await prisma.groupBab.updateMany({
			where: { groupId: group.id, number: { in: [11, 12] } },
			data: { assignedUserId: MEMBER, readByUserId: MEMBER }
		});

		await removeMemberForUser(OWNER, group.id, MEMBER);

		expect((await prisma.groupMember.findMany({ where: { groupId: group.id } })).map(m => m.slotIndex)).toEqual([
			0, 2
		]);
		expect(await prisma.groupBab.count({ where: { groupId: group.id, assignedUserId: MEMBER } })).toBe(0);
		expect(await prisma.groupBab.count({ where: { groupId: group.id, readByUserId: MEMBER } })).toBe(2);
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).completedAt).not.toBeNull();
	});

	it('returns a Kur’an member’s cüz to the pool in every round, and nobody else’s', async () => {
		const group = await createGroup('HATIM', 'RUNNING');
		await prisma.cuzHolding.createMany({
			data: [
				{ cuzNumber: 1, groupId: group.id, roundIndex: 0, userId: MEMBER },
				{ cuzNumber: 2, groupId: group.id, roundIndex: 1, userId: MEMBER },
				{ cuzNumber: 3, groupId: group.id, roundIndex: 0, userId: OTHER }
			]
		});

		await removeMemberForUser(OWNER, group.id, MEMBER);

		expect(await prisma.cuzHolding.findMany({ where: { groupId: group.id } })).toEqual([
			expect.objectContaining({ cuzNumber: 3, userId: OTHER })
		]);
	});
});
