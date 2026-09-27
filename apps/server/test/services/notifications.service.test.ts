import prisma from '@db/prisma';
import { listNotificationsForUser, recordNotification } from '@services/notifications.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const READER = 'test_reader';

const createGroup = (kind: 'CEVSEN' | 'HATIM', name: string) =>
	prisma.group.create({
		data: {
			cycle: 'WEEKLY',
			inviteCode: `N${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind,
			name,
			ownerUserId: 'test_owner',
			roundIndex: 0,
			spots: kind === 'HATIM' ? 30 : 10,
			splitMode: 'FIXED',
			status: 'GATHERING',
			timezone: 'UTC',
			visibility: 'OPEN'
		}
	});

beforeEach(async () => {
	await prisma.notification.deleteMany();
	await prisma.group.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('the inbox says which kind of group a row is about (Q8)', () => {
	it('carries the group’s kind, and none once the group is gone', async () => {
		const hatim = await createGroup('HATIM', 'Ramazan Hatmi');
		const cevsen = await createGroup('CEVSEN', 'Cuma Cevşeni');

		await recordNotification({
			groupId: hatim.id,
			groupName: hatim.name,
			payload: { kind: 'POOL_BAB_CLAIMED', range: '18', takerName: 'Zeynep' },
			userIds: [READER]
		});
		await recordNotification({
			groupId: cevsen.id,
			groupName: cevsen.name,
			payload: { kind: 'MEMBER_JOINED', memberCount: 4, memberName: 'Fatma', spots: 10 },
			userIds: [READER]
		});

		const kinds = async () =>
			Object.fromEntries((await listNotificationsForUser(READER)).map(row => [row.groupName, row.groupKind]));

		expect(await kinds()).toEqual({ 'Cuma Cevşeni': 'CEVSEN', 'Ramazan Hatmi': 'HATIM' });

		// The relation is `SetNull`, so the row outlives the group and keeps its name.
		await prisma.group.delete({ where: { id: hatim.id } });

		expect(await kinds()).toEqual({ 'Cuma Cevşeni': 'CEVSEN', 'Ramazan Hatmi': null });
	});
});
