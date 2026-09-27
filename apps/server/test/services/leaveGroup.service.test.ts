import prisma from '@db/prisma';
import { leaveGroupForUser } from '@services/groupMembership.service';
import { CUZ_COUNT } from '@utils/units';
import { DEFAULT_TIME_ZONE } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const LEAVER = 'test_leaver';

/**
 * **What a departing member takes with them, and what they leave behind.**
 *
 * The distinction is between a promise and a fact. A claim and a hatim's holdings say "I
 * will read this", which somebody who has gone will not — those are released. A read says
 * "this was read", which stays true whoever has since left; clearing it puts a finished bab
 * back on the board as outstanding, tells the group to read something already read, and
 * quietly un-completes a round that was done.
 *
 * It used to clear them, which was invisible precisely because `BabRead` kept the history —
 * the record stayed right while the board disagreed with it.
 */
const createGroup = async (kind: 'CEVSEN' | 'HATIM') => {
	const unitCount = kind === 'HATIM' ? CUZ_COUNT : 100;

	const group = await prisma.group.create({
		data: {
			...(kind === 'HATIM' ? { boundaryPolicy: 'KEEP' as const, distribution: 'FREE_PICK' as const } : {}),
			cycle: 'DAILY',
			inviteCode: `L${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind,
			name: 'Leave Hatmi',
			ownerUserId: OWNER,
			roundDays: 1,
			roundIndex: 0,
			roundStartedAt: new Date(),
			spots: kind === 'HATIM' ? CUZ_COUNT : 10,
			splitMode: 'FIXED',
			startedAt: new Date(),
			startsAt: new Date(),
			status: 'RUNNING',
			timezone: DEFAULT_TIME_ZONE
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: unitCount }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});

	await prisma.groupMember.createMany({
		data: [
			{ displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER },
			{ displayName: 'Leaver', groupId: group.id, role: 'MEMBER', slotIndex: 1, userId: LEAVER }
		]
	});

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

describe('leaving a group', () => {
	it('leaves every read standing', async () => {
		const group = await createGroup('CEVSEN');

		await prisma.groupBab.updateMany({
			data: { readAt: new Date(), readByUserId: LEAVER },
			where: { groupId: group.id, number: { in: [11, 12, 13] } }
		});

		await leaveGroupForUser(LEAVER, group.id);

		const stillRead = await prisma.groupBab.count({
			where: { groupId: group.id, readByUserId: LEAVER, readAt: { not: null } }
		});

		// Three babs were read. Somebody leaving does not make them unread.
		expect(stillRead).toBe(3);
	});

	it('releases a pool claim, because a claim is a promise and they have gone', async () => {
		const group = await createGroup('CEVSEN');

		await prisma.groupBab.updateMany({
			data: { assignedUserId: LEAVER },
			where: { groupId: group.id, number: { in: [40, 41] } }
		});

		await leaveGroupForUser(LEAVER, group.id);

		expect(await prisma.groupBab.count({ where: { groupId: group.id, assignedUserId: LEAVER } })).toBe(0);
	});

	it('keeps a read bab they had also claimed', async () => {
		// The two states live on the same row, and only one of them is a promise.
		const group = await createGroup('CEVSEN');

		await prisma.groupBab.updateMany({
			data: { assignedUserId: LEAVER, readAt: new Date(), readByUserId: LEAVER },
			where: { groupId: group.id, number: 55 }
		});

		await leaveGroupForUser(LEAVER, group.id);

		const bab = await prisma.groupBab.findFirstOrThrow({ where: { groupId: group.id, number: 55 } });

		expect(bab.assignedUserId).toBeNull();
		expect(bab.readByUserId).toBe(LEAVER);
	});

	it('returns a hatim leaver’s cüz to the pool without unreading them', async () => {
		const group = await createGroup('HATIM');

		await prisma.cuzHolding.createMany({
			data: [
				{ cuzNumber: 7, groupId: group.id, roundIndex: 0, userId: LEAVER },
				{ cuzNumber: 22, groupId: group.id, roundIndex: 0, userId: LEAVER }
			]
		});
		await prisma.groupBab.updateMany({
			data: { readAt: new Date(), readByUserId: LEAVER },
			where: { groupId: group.id, number: 7 }
		});

		await leaveGroupForUser(LEAVER, group.id);

		// Nobody holds them any more, so they are back in the pool for somebody else…
		expect(await prisma.cuzHolding.count({ where: { groupId: group.id, userId: LEAVER } })).toBe(0);
		// …but cüz 7 was read, and it stays read.
		const bab = await prisma.groupBab.findFirstOrThrow({ where: { groupId: group.id, number: 7 } });

		expect(bab.readByUserId).toBe(LEAVER);
	});

	it('does not un-complete a finished round', async () => {
		/*
		 * The consequence that made the old behaviour worse than a cosmetic bug: clearing the
		 * leaver's reads could take a group from complete back to incomplete, so a round
		 * everybody had finished quietly reopened.
		 */
		const group = await createGroup('HATIM');
		const readAt = new Date();

		await prisma.groupBab.updateMany({
			data: { readAt, readByUserId: LEAVER },
			where: { groupId: group.id }
		});
		await prisma.group.update({ data: { completedAt: readAt }, where: { id: group.id } });

		await leaveGroupForUser(LEAVER, group.id);

		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).completedAt).not.toBeNull();
	});
});
