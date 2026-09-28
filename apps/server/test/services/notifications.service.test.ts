import prisma from '@db/prisma';
import { listNotificationsForUser, recordNotification } from '@services/notifications.service';
import { updateGroupForUser } from '@services/groups.service';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));

assertIsTestDatabase(testDatabaseUrl());

const READER = 'test_inbox_reader';

const KIND_READER = 'test_reader';

const createKindGroup = (kind: 'CEVSEN' | 'HATIM', name: string) =>
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
	await prisma.notification.deleteMany({ where: { userId: { in: [READER, KIND_READER] } } });
});

afterAll(async () => {
	await prisma.notification.deleteMany({ where: { userId: { in: [READER, KIND_READER] } } });
	await prisma.$disconnect();
});

describe('listNotificationsForUser', () => {
	it('anonymizes existing and new notices and keeps names hidden after deletion', async () => {
		const group = await createGroup('CEVSEN', 'PRIVACY1');
		await prisma.groupMember.create({
			data: { groupId: group.id, userId: 'test_owner', displayName: 'Owner', role: 'OWNER', slotIndex: 0 }
		});
		await recordNotification({
			groupId: group.id,
			groupName: group.name,
			userIds: [READER],
			payload: { kind: 'SHARE_READ', readerName: 'Secret Name', range: '1–5' }
		});
		await updateGroupForUser('test_owner', group.id, { hideMemberNames: true });
		await recordNotification({
			groupId: group.id,
			groupName: group.name,
			userIds: [READER],
			payload: { kind: 'MEMBER_JOINED', memberName: 'New Secret', memberCount: 2, spots: 20 }
		});
		expect(JSON.stringify(await listNotificationsForUser(READER))).not.toContain('Secret');
		await prisma.group.delete({ where: { id: group.id } });
		const archived = await listNotificationsForUser(READER);
		expect(JSON.stringify(archived)).not.toContain('Secret');
		expect(archived.every(row => row.payload.anonymous === true)).toBe(true);
	});
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

describe('the inbox says which kind of group a row is about (Q8)', () => {
	it('carries the group’s kind, and the Cevşen’s once the group is gone', async () => {
		const hatim = await createKindGroup('HATIM', 'Ramazan Hatmi');
		const cevsen = await createKindGroup('CEVSEN', 'Cuma Cevşeni');

		await recordNotification({
			groupId: hatim.id,
			groupName: hatim.name,
			payload: { kind: 'POOL_BAB_CLAIMED', range: '18', takerName: 'Zeynep' },
			userIds: [KIND_READER]
		});
		await recordNotification({
			groupId: cevsen.id,
			groupName: cevsen.name,
			payload: { kind: 'MEMBER_JOINED', memberCount: 4, memberName: 'Fatma', spots: 10 },
			userIds: [KIND_READER]
		});

		const kinds = async () =>
			Object.fromEntries(
				(await listNotificationsForUser(KIND_READER)).map(row => [row.groupName, row.groupKind])
			);

		expect(await kinds()).toEqual({ 'Cuma Cevşeni': 'CEVSEN', 'Ramazan Hatmi': 'HATIM' });

		// The relation is `SetNull`, so the row outlives the group and keeps its name.
		await prisma.group.delete({ where: { id: hatim.id } });

		// Nothing left to join, so the row reads as a Cevşen one — which is how every client
		// already drew a row without a kind.
		expect(await kinds()).toEqual({ 'Cuma Cevşeni': 'CEVSEN', 'Ramazan Hatmi': 'CEVSEN' });
	});
});
