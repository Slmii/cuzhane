import prisma from '@db/prisma';
import { RegisterPushTokenBodySchema, RemovePushTokenBodySchema } from '@schemas/pushToken.schema';
import { getPushTokensForUser, registerPushToken, removePushToken } from '@services/pushToken.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const ME = 'reader';
const SOMEONE = 'someone';
const token = (name: string) => `ExponentPushToken[${name}]`;

beforeEach(async () => {
	await prisma.pushToken.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('registering a device', () => {
	it('accepts only a real Expo token; withdrawing takes any token', () => {
		expect(RegisterPushTokenBodySchema.safeParse({ token: token('abc') }).success).toBe(true);
		expect(RegisterPushTokenBodySchema.safeParse({ token: 'not-a-token' }).success).toBe(false);
		expect(RegisterPushTokenBodySchema.safeParse({ token: '' }).success).toBe(false);
		// One stored before the Expo check must still be removable.
		expect(RemovePushTokenBodySchema.safeParse({ token: 'not-a-token' }).success).toBe(true);
	});

	it('keeps one row per device, and moves it to whoever signs in on it', async () => {
		await registerPushToken(ME, token('phone'));
		await registerPushToken(ME, token('phone'));
		expect(await getPushTokensForUser(ME)).toEqual([token('phone')]);

		await registerPushToken(SOMEONE, token('phone'));
		expect(await getPushTokensForUser(ME)).toEqual([]);
		expect(await getPushTokensForUser(SOMEONE)).toEqual([token('phone')]);
	});

	it('keeps an account’s ten most recent devices', async () => {
		for (let device = 1; device <= 12; device++) {
			await registerPushToken(ME, token(`device-${device}`));
			// A distinct `updatedAt` per device, so "most recent" is unambiguous.
			await new Promise(resolve => setTimeout(resolve, 5));
		}

		const kept = await getPushTokensForUser(ME);
		expect(kept).toHaveLength(10);
		expect(kept).not.toContain(token('device-1'));
		expect(kept).not.toContain(token('device-2'));
		expect(kept).toContain(token('device-12'));
	});

	it('withdraws only the caller’s own token', async () => {
		await registerPushToken(ME, token('mine'));
		await registerPushToken(SOMEONE, token('theirs'));

		await removePushToken(ME, token('theirs'));
		expect(await getPushTokensForUser(SOMEONE)).toEqual([token('theirs')]);

		await removePushToken(ME, token('mine'));
		expect(await getPushTokensForUser(ME)).toEqual([]);
	});
});
