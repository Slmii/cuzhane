import prisma from '@db/prisma';
import { previewGroupByCode } from '@services/groupMembership.service';
import { getUserSettingsForUser, updateUserSettingsForUser } from '@services/userSettings.service';
import { UpdateUserSettingsBodySchema } from '@schemas/userSettings.schema';
import { generateInviteCode } from '@utils/inviteCode';
import { DEFAULT_TIME_ZONE } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_legacy_owner';
const VIEWER = 'test_legacy_viewer';
const BAB_COUNT = 100;

/**
 * **What the 1.2.0 app still reads and sends.** Production users stay on it until an update
 * reaches them, so these two shapes must survive the API it now talks to.
 */
const createCevsen = async () => {
	// The app's own generator: a code outside the invite alphabet would be normalised away on lookup.
	const inviteCode = generateInviteCode();
	const group = await prisma.group.create({
		data: {
			cycle: 'DAILY',
			inviteCode,
			name: 'Legacy Hatmi',
			openToJoin: true,
			ownerUserId: OWNER,
			roundDays: 1,
			spots: 5,
			splitMode: 'FIXED',
			startsAt: new Date(),
			status: 'GATHERING',
			timezone: DEFAULT_TIME_ZONE,
			visibility: 'OPEN'
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: BAB_COUNT }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});
	await prisma.groupMember.create({
		data: { displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER }
	});

	return inviteCode;
};

const cleanUp = async () => {
	await prisma.group.deleteMany({ where: { ownerUserId: OWNER } });
	await prisma.userSettings.deleteMany({ where: { userId: VIEWER } });
};

beforeEach(cleanUp);
afterAll(async () => {
	await cleanUp();
	await prisma.$disconnect();
});

describe('the 1.2.0 app', () => {
	it('gets an invite preview with an empty memberNames, which names nobody', async () => {
		const code = await createCevsen();
		const preview = await previewGroupByCode(VIEWER, code);

		expect(preview.memberNames).toEqual([]);
		expect(preview.memberCount).toBe(1);
	});

	it('reads the Cevşen switches under their old names', async () => {
		await updateUserSettingsForUser(VIEWER, { cevsenGroupReadsEnabled: true, cevsenPoolClaimEnabled: true });
		const settings = await getUserSettingsForUser(VIEWER);

		expect(settings).toMatchObject({ groupReadsEnabled: true, poolClaimEnabled: true, roundCompleteEnabled: true });
	});

	it('writes them under their old names, and the old names pass validation', async () => {
		const body = UpdateUserSettingsBodySchema.parse({ groupReadsEnabled: true, roundCompleteEnabled: false });
		const settings = await updateUserSettingsForUser(VIEWER, body);

		expect(settings).toMatchObject({ cevsenGroupReadsEnabled: true, cevsenRoundCompleteEnabled: false });
	});

	it('lets the new name win when both arrive', async () => {
		const settings = await updateUserSettingsForUser(VIEWER, {
			cevsenGroupReadsEnabled: false,
			groupReadsEnabled: true
		});

		expect(settings.cevsenGroupReadsEnabled).toBe(false);
	});
});
