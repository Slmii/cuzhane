import prisma from '@db/prisma';
import { checkPushReceipts, sendPushToUser } from '@services/push.service';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const USER = 'test_push_user';
/** Expo's own shape — `Expo.isExpoPushToken` rejects anything else before a send. */
const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

// `vi.hoisted`, because `vi.mock` is lifted above every `const` in the file and the fake
// class reads this while it is still in the temporal dead zone otherwise.
const { sendMock, receiptsMock } = vi.hoisted(() => ({ sendMock: vi.fn(), receiptsMock: vi.fn() }));

/*
 * Only the network call is faked. Token lookup, filtering, chunking and the pruning of dead
 * tokens are the parts worth testing, and they all run for real against the test database.
 */
vi.mock('expo-server-sdk', async () => {
	const actual = await vi.importActual<typeof import('expo-server-sdk')>('expo-server-sdk');

	/*
	 * Extends the real client rather than reimplementing it: chunking is inherited with a
	 * working `this`, and only the two methods that would hit the network are replaced.
	 * Borrowing the prototype methods onto a bare class silently broke them — they call
	 * through `this`, so they threw, and the swallowed error looked like "nothing to prune".
	 */
	class FakeExpo extends actual.Expo {
		sendPushNotificationsAsync = sendMock;

		getPushNotificationReceiptsAsync = receiptsMock;
	}

	return { ...actual, Expo: FakeExpo };
});

beforeEach(async () => {
	sendMock.mockReset();
	receiptsMock.mockReset();
	await prisma.pushToken.deleteMany({ where: { userId: USER } });
});

afterAll(async () => {
	await prisma.pushToken.deleteMany({ where: { userId: USER } });
	await prisma.$disconnect();
});

describe('sendPushToUser', () => {
	it('sends nothing when the user has no registered device', async () => {
		expect(await sendPushToUser(USER, { title: 'x', body: 'y' })).toBe(0);
		expect(sendMock).not.toHaveBeenCalled();
	});

	it('sends one message per registered device', async () => {
		await prisma.pushToken.createMany({
			data: [
				{ userId: USER, token: TOKEN_A },
				{ userId: USER, token: TOKEN_B }
			]
		});
		sendMock.mockResolvedValue([
			{ status: 'ok', id: '1' },
			{ status: 'ok', id: '2' }
		]);

		expect(await sendPushToUser(USER, { title: 'x', body: 'y' })).toBe(2);
		expect(sendMock.mock.calls[0]?.[0]).toHaveLength(2);
	});

	it('drops a token Expo says the device no longer has', async () => {
		await prisma.pushToken.createMany({
			data: [
				{ userId: USER, token: TOKEN_A },
				{ userId: USER, token: TOKEN_B }
			]
		});
		sendMock.mockResolvedValue([
			{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
			{ status: 'ok', id: '2' }
		]);

		await sendPushToUser(USER, { title: 'x', body: 'y' });

		// Kept forever, a stale token is retried on every future send and never recovers.
		const left = await prisma.pushToken.findMany({ where: { userId: USER }, select: { token: true } });

		expect(left.map(row => row.token)).toEqual([TOKEN_B]);
	});

	it('survives Expo throwing, because the caller is mid-join', async () => {
		await prisma.pushToken.create({ data: { userId: USER, token: TOKEN_A } });
		sendMock.mockRejectedValue(new Error('network down'));

		// A push is a courtesy; the join is the point. This must never propagate.
		await expect(sendPushToUser(USER, { title: 'x', body: 'y' })).resolves.toBe(0);
		expect(await prisma.pushToken.count({ where: { userId: USER } })).toBe(1);
	});

	it('ignores a token that is not an Expo token', async () => {
		await prisma.pushToken.create({ data: { userId: USER, token: 'not-a-push-token' } });

		expect(await sendPushToUser(USER, { title: 'x', body: 'y' })).toBe(0);
		expect(sendMock).not.toHaveBeenCalled();
	});
});

describe('checkPushReceipts', () => {
	it('drops the token behind a DeviceNotRegistered receipt', async () => {
		await prisma.pushToken.createMany({
			data: [
				{ userId: USER, token: TOKEN_A },
				{ userId: USER, token: TOKEN_B }
			]
		});
		receiptsMock.mockResolvedValue({
			'ticket-a': { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
			'ticket-b': { status: 'ok' }
		});

		await checkPushReceipts([
			{ ticketId: 'ticket-a', token: TOKEN_A },
			{ ticketId: 'ticket-b', token: TOKEN_B }
		]);

		const left = await prisma.pushToken.findMany({ where: { userId: USER }, select: { token: true } });

		expect(left.map(row => row.token)).toEqual([TOKEN_B]);
	});

	it('keeps the token when APNs rejects it as BadDeviceToken', async () => {
		await prisma.pushToken.create({ data: { userId: USER, token: TOKEN_A } });
		receiptsMock.mockResolvedValue({
			'ticket-a': { status: 'error', message: 'bad token', details: { error: 'BadDeviceToken' } }
		});

		await checkPushReceipts([{ ticketId: 'ticket-a', token: TOKEN_A }]);

		// BadDeviceToken means the *build* is wrong — no push entitlement, or the other APNs
		// environment. Deleting the token would fix nothing and would empty the table for
		// every user on that build.
		expect(await prisma.pushToken.count({ where: { userId: USER } })).toBe(1);
	});

	it('asks for nothing when no message was accepted', async () => {
		await checkPushReceipts([]);

		expect(receiptsMock).not.toHaveBeenCalled();
	});

	it('survives Expo throwing while fetching receipts', async () => {
		await prisma.pushToken.create({ data: { userId: USER, token: TOKEN_A } });
		receiptsMock.mockRejectedValue(new Error('network down'));

		await expect(checkPushReceipts([{ ticketId: 'ticket-a', token: TOKEN_A }])).resolves.toBeUndefined();
		expect(await prisma.pushToken.count({ where: { userId: USER } })).toBe(1);
	});
});
