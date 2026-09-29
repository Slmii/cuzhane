import prisma from '@db/prisma';
import { UpdateUserSettingsBodySchema } from '@schemas/userSettings.schema';
import { getUserSettingsForUser, updateUserSettingsForUser } from '@services/userSettings.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const USER = 'test_settings_user';

const cleanUp = async () => {
	await prisma.userSettings.deleteMany({ where: { userId: USER } });
};

beforeEach(cleanUp);
afterAll(async () => {
	await cleanUp();
	await prisma.$disconnect();
});

describe('the "how the group works" screen after joining', () => {
	it('shows for every kind on a new account', async () => {
		const settings = await getUserSettingsForUser(USER);

		expect([settings.cevsenIntroEnabled, settings.hatimIntroEnabled, settings.hizbIntroEnabled]).toEqual([
			true,
			true,
			true
		]);
	});

	it('turns off for one kind only — "bir daha gösterme" on a Cevşen group leaves the others showing', async () => {
		const body = UpdateUserSettingsBodySchema.parse({ cevsenIntroEnabled: false });

		expect((await updateUserSettingsForUser(USER, body)).cevsenIntroEnabled).toBe(false);

		const settings = await getUserSettingsForUser(USER);

		expect([settings.cevsenIntroEnabled, settings.hatimIntroEnabled, settings.hizbIntroEnabled]).toEqual([
			false,
			true,
			true
		]);
	});
});
