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

describe('the daily reminders', () => {
	it('starts with the Hizb’s on and the Cevşen’s off, each at 21:30', async () => {
		const settings = await getUserSettingsForUser(USER);

		expect(settings).toMatchObject({
			hizbReminderEnabled: true,
			hizbReminderTime: '21:30',
			reminderEnabled: false,
			reminderTime: '21:30'
		});
	});

	it('keeps each reminder’s time its own', async () => {
		await updateUserSettingsForUser(USER, UpdateUserSettingsBodySchema.parse({ hizbReminderTime: '15:00' }));

		expect(await getUserSettingsForUser(USER)).toMatchObject({ hizbReminderTime: '15:00', reminderTime: '21:30' });
	});

	it('turns the Hizb’s off on its own, leaving the Cevşen’s and the time as they were', async () => {
		await updateUserSettingsForUser(USER, UpdateUserSettingsBodySchema.parse({ reminderEnabled: true }));

		const settings = await updateUserSettingsForUser(
			USER,
			UpdateUserSettingsBodySchema.parse({ hizbReminderEnabled: false })
		);

		expect(settings).toMatchObject({ hizbReminderEnabled: false, reminderEnabled: true, reminderTime: '21:30' });
	});

	it('refuses a switch that is not a yes or a no, and a time that is not a time', () => {
		expect(UpdateUserSettingsBodySchema.safeParse({ hizbReminderEnabled: 'yes' }).success).toBe(false);
		expect(UpdateUserSettingsBodySchema.safeParse({ hizbReminderTime: '25:00' }).success).toBe(false);
	});
});
