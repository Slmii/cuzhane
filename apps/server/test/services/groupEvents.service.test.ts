import prisma from '@db/prisma';
import { notifyGroupMembers } from '@services/groupEvents.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const ACTOR = 'test_actor';
const OTHER = 'test_other';

const createGroup = async () => {
	const group = await prisma.group.create({
		data: {
			inviteCode: `E${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			name: 'Olaylar Hatmi',
			ownerUserId: ACTOR,
			spots: 5
		}
	});

	await prisma.groupMember.createMany({
		data: [
			{ displayName: 'Actor', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: ACTOR },
			{ displayName: 'Other', groupId: group.id, role: 'MEMBER', slotIndex: 1, userId: OTHER }
		]
	});

	return group;
};

const takePool = (groupId: string, subject: string) =>
	notifyGroupMembers({
		actorUserId: ACTOR,
		build: ({ actorName }) => ({
			payload: { kind: 'POOL_BAB_CLAIMED', range: subject, takerName: actorName },
			push: () => ({ body: 'b', title: 't' })
		}),
		excludeUserIds: [ACTOR],
		groupId,
		pushKind: 'pool-claim',
		setting: 'cevsenPoolClaimEnabled',
		subject
	});

const inboxOf = (userId: string) => prisma.notification.count({ where: { userId } });

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group", "Notification" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

/*
 * A take/release loop — or join/leave on an open group — filed an inbox row for every member,
 * and pushed to them, on every turn. Each event is now said once per actor, per round, per
 * subject.
 */
describe('group events are said once', () => {
	it('files one row for the same slot taken again in the same round', async () => {
		const group = await createGroup();

		await takePool(group.id, '3');
		await takePool(group.id, '3');
		await takePool(group.id, '3');

		expect(await inboxOf(OTHER)).toBe(1);
	});

	it('still announces a different slot, and the same one in the next round', async () => {
		const group = await createGroup();

		await takePool(group.id, '3');
		await takePool(group.id, '4');
		await prisma.group.update({ data: { roundIndex: 1 }, where: { id: group.id } });
		await takePool(group.id, '3');

		expect(await inboxOf(OTHER)).toBe(3);
	});
});
