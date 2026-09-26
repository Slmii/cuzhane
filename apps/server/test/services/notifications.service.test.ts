import prisma from '@db/prisma';
import { listNotificationsForUser, recordNotification } from '@services/notifications.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const READER = 'test_inbox_reader';

const createGroup = (kind: 'CEVSEN' | 'HIZB', inviteCode: string) =>
	prisma.group.create({ data: { ownerUserId: 'test_owner', name: `${kind} Halkası`, inviteCode, kind } });

const file = (groupId: string, groupName: string) =>
	recordNotification({
		groupId,
		groupName,
		payload: { kind: 'ROUND_COMPLETE', roundNumber: 1 },
		userIds: [READER]
	});

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
	await prisma.notification.deleteMany({ where: { userId: READER } });
});

afterAll(async () => {
	await prisma.notification.deleteMany({ where: { userId: READER } });
	await prisma.$disconnect();
});

describe('listNotificationsForUser', () => {
	it('carries the kind of the group each row is about', async () => {
		const hizb = await createGroup('HIZB', 'INBOXHZ1');
		const cevsen = await createGroup('CEVSEN', 'INBOXCV1');
		await file(hizb.id, hizb.name);
		await file(cevsen.id, cevsen.name);

		const rows = await listNotificationsForUser(READER);
		const kindByGroupId = new Map(rows.map(row => [row.groupId, row.groupKind]));

		expect(kindByGroupId.get(hizb.id)).toBe('HIZB');
		expect(kindByGroupId.get(cevsen.id)).toBe('CEVSEN');
	});

	it('reads a row whose group is gone as a Cevşen one', async () => {
		const hizb = await createGroup('HIZB', 'INBOXHZ2');
		await file(hizb.id, hizb.name);
		await prisma.group.delete({ where: { id: hizb.id } });

		const [row] = await listNotificationsForUser(READER);

		// The row outlives its group — `groupId` goes null — so there is no kind left to join.
		expect(row?.groupId).toBeNull();
		expect(row?.groupName).toBe('HIZB Halkası');
		expect(row?.groupKind).toBe('CEVSEN');
	});
});
