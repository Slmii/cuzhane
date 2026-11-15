import prisma from '@db/prisma';
import { getGroupDetailForUser, updateGroupForUser } from '@services/groups.service';
import { listMembersForUser, previewGroupById } from '@services/groupMembership.service';
import { listBabsForUser, setAssignedBabsReadForUser } from '@services/babs.service';
import { listPoolSlotsForUser } from '@services/pool.service';
import { recordNotification } from '@services/notifications.service';
import { sendPushToUser } from '@services/push.service';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: vi.fn(async () => 0) }));
assertIsTestDatabase(testDatabaseUrl());
const OWNER = 'privacy_owner_secret';
const VIEWER = 'privacy_viewer';
const create = () =>
	prisma.group.create({
		data: {
			name: 'Anonymous circle',
			ownerUserId: OWNER,
			hideMemberNames: true,
			inviteCode: 'ANONTEST',
			splitMode: 'FIXED',
			cycle: 'DAILY',
			spots: 5,
			status: 'RUNNING',
			startedAt: new Date(),
			roundStartedAt: new Date(),
			members: {
				create: [
					{ userId: OWNER, displayName: 'Secret Owner', role: 'OWNER', slotIndex: 0 },
					{ userId: VIEWER, displayName: 'Viewer', slotIndex: 1 }
				]
			},
			babs: {
				create: Array.from({ length: 100 }, (_, i) => ({
					number: i + 1,
					assignedUserId: i === 40 ? OWNER : null
				}))
			}
		}
	});

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
	await prisma.userSettings.deleteMany({ where: { userId: VIEWER } });
});
afterAll(async () => {
	await prisma.userSettings.deleteMany({ where: { userId: VIEWER } });
	await prisma.$disconnect();
});

describe('privacy at service response boundaries', () => {
	it('hides names and identifiers across members, board, pool and invites', async () => {
		const group = await create();
		await setAssignedBabsReadForUser(OWNER, group.id, true);
		const results = await Promise.all([
			getGroupDetailForUser(VIEWER, group.id),
			listMembersForUser(VIEWER, group.id),
			listBabsForUser(VIEWER, group.id),
			listPoolSlotsForUser(VIEWER, group.id),
			previewGroupById('outsider', group.id)
		]);
		const serialized = JSON.stringify(results);
		expect(serialized).not.toContain(OWNER);
		expect(serialized).not.toContain('Secret Owner');
		expect(serialized).toContain('anonymous:');
	});

	it('sends an anonymous reading notification in the recipient language', async () => {
		const group = await create();
		await prisma.userSettings.create({ data: { userId: VIEWER, cevsenGroupReadsEnabled: true, language: 'nl' } });
		await setAssignedBabsReadForUser(OWNER, group.id, true);
		const calls = vi.mocked(sendPushToUser).mock.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0]?.[1].body).toContain('Een lid');
		expect(JSON.stringify(calls)).not.toContain('Secret Owner');
	});

	it('never stores named events after a concurrent privacy enable', async () => {
		const group = await create();
		for (let i = 0; i < 5; i++) {
			await updateGroupForUser(OWNER, group.id, { hideMemberNames: false });
			await Promise.all([
				recordNotification({
					groupId: group.id,
					groupName: group.name,
					userIds: [VIEWER],
					payload: { kind: 'SHARE_READ', readerName: 'Secret Reader', range: '1–20' }
				}),
				updateGroupForUser(OWNER, group.id, { hideMemberNames: true })
			]);
		}
		const stored = await prisma.notification.findMany({ where: { groupId: group.id } });
		expect(stored).toHaveLength(5);
		expect(JSON.stringify(stored)).not.toContain('Secret Reader');
	});
});
