import prisma from '@db/prisma';
import { recordNotification } from '@services/notifications.service';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

/*
 * The whole API as the app mounts it (`createApp`), with Clerk replaced by a header: a request
 * carrying `x-test-user` is signed in as that user, one without it is not. The real Clerk gate is
 * exercised separately (`mushafAuth.test.ts`); this file is about everything behind it.
 */
vi.mock('@clerk/express', () => ({
	clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	getAuth: (req: { get: (name: string) => string | undefined }) => {
		const userId = req.get('x-test-user') ?? null;

		return { userId, sessionClaims: userId ? { name: userId } : null };
	},
	clerkClient: { users: { getUser: async () => Promise.reject(new Error('no Clerk in tests')) } }
}));
vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: vi.fn(async () => 0) }));
// The meal's credentials are optional; without them the route must say so rather than fail.
vi.mock('@config/env', async () => {
	const actual = await vi.importActual<typeof import('@config/env')>('@config/env');

	return { env: { ...actual.env, QURAN_CLIENT_ID: undefined, QURAN_CLIENT_SECRET: undefined } };
});

const { createApp } = await import('@app');

let server: Server;
let origin = '';

beforeAll(async () => {
	server = createApp().listen(0);
	await new Promise(resolve => server.once('listening', resolve));
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
	await prisma.notification.deleteMany({});
	await prisma.pushToken.deleteMany({});
	await prisma.userSettings.deleteMany({});
	await prisma.feedback.deleteMany({});
});

afterAll(async () => {
	await new Promise(resolve => server.close(resolve));
	await prisma.$disconnect();
});

/** Every new-build header, so Hizb groups are not hidden from the caller. */
const MODERN = { 'X-Cuzhane-Kinds': 'CEVSEN,HATIM,HIZB', 'X-Cuzhane-Hizb-Plans': '1' };

const call = (
	method: string,
	path: string,
	{ user, body, headers = {} }: { user?: string; body?: unknown; headers?: Record<string, string> } = {}
) =>
	fetch(origin + path, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(user ? { 'x-test-user': user } : {}),
			...headers
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});

const createGroup = async (user: string, overrides: Record<string, unknown> = {}) => {
	const response = await call('POST', '/api/groups', {
		user,
		headers: MODERN,
		body: {
			name: 'Test grubu',
			kind: 'CEVSEN',
			spots: 5,
			cycle: 'DAILY',
			splitMode: 'FIXED',
			visibility: 'OPEN',
			reminderTime: '21:00',
			timezone: 'Europe/Istanbul',
			...overrides
		}
	});
	expect(response.status).toBe(201);

	return (await response.json()) as { id: string; inviteCode: string; kind: string };
};

describe('the gate', () => {
	it('keeps /health public', async () => {
		expect((await call('GET', '/health')).status).toBe(200);
	});

	it.each([
		['GET', '/api/groups'],
		['GET', '/api/groups/discover'],
		['POST', '/api/groups'],
		['GET', '/api/babs/some-group'],
		['POST', '/api/cheers/some-group'],
		['GET', '/api/user-settings'],
		['GET', '/api/notifications'],
		['POST', '/api/push-tokens'],
		['GET', '/api/profile/stats'],
		['DELETE', '/api/account'],
		['POST', '/api/feedback'],
		['GET', '/api/quran/translation?verseKey=1:1&lang=tr'],
		['GET', '/api/memberships/preview/code/ABCDEFGH'],
		['GET', '/api/groups/some-group/reading'],
		['GET', '/api/mushaf/page-001.png']
	])('answers 401 JSON to %s %s without a session', async (method, path) => {
		const response = await call(method, path);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	it('answers an unknown route with 404 JSON, signed in or not', async () => {
		const outside = await call('GET', '/nowhere');
		expect(outside.status).toBe(404);
		expect(await outside.json()).toEqual({ error: 'Route not found' });
		expect((await call('GET', '/api/nowhere', { user: 'someone' })).status).toBe(404);
	});

	it('refuses an id longer than 64 characters with 400', async () => {
		expect((await call('GET', `/api/groups/${'a'.repeat(65)}`, { user: 'someone', headers: MODERN })).status).toBe(
			400
		);
	});
});

describe('user settings', () => {
	it('reads defaults, saves a change, and refuses an impossible time', async () => {
		const first = await call('GET', '/api/user-settings', { user: 'settings_user' });
		expect(first.status).toBe(200);
		expect(await first.json()).toMatchObject({ language: expect.any(String), reminderEnabled: false });

		expect(
			(await call('PATCH', '/api/user-settings', { user: 'settings_user', body: { reminderTime: '25:00' } }))
				.status
		).toBe(400);

		const saved = await call('PATCH', '/api/user-settings', { user: 'settings_user', body: { language: 'nl' } });
		expect(saved.status).toBe(200);
		expect(await (await call('GET', '/api/user-settings', { user: 'settings_user' })).json()).toMatchObject({
			language: 'nl'
		});
	});
});

describe('the inbox', () => {
	it('lists the caller’s notifications, counts the unread and marks them all read', async () => {
		const group = await createGroup('inbox_owner');
		await recordNotification({
			groupId: group.id,
			groupName: 'Test grubu',
			payload: { kind: 'MEMBER_JOINED', memberCount: 2, memberName: 'Someone', spots: 5 },
			userIds: ['inbox_owner']
		});

		const list = (await (await call('GET', '/api/notifications', { user: 'inbox_owner' })).json()) as unknown[];
		expect(list).toHaveLength(1);
		expect(await (await call('GET', '/api/notifications', { user: 'someone_else' })).json()).toEqual([]);
		expect(await (await call('GET', '/api/notifications/unread-count', { user: 'inbox_owner' })).json()).toEqual({
			count: 1
		});

		expect((await call('PATCH', '/api/notifications/read-all', { user: 'inbox_owner' })).status).toBe(204);
		expect(await (await call('GET', '/api/notifications/unread-count', { user: 'inbox_owner' })).json()).toEqual({
			count: 0
		});
	});
});

describe('push tokens', () => {
	it('accepts only an Expo token, and removes it again', async () => {
		const token = 'ExponentPushToken[abcdefghijklmnopqrstuv]';

		expect(
			(await call('POST', '/api/push-tokens', { user: 'device_user', body: { token: 'not-a-token' } })).status
		).toBe(400);
		expect((await call('POST', '/api/push-tokens', { user: 'device_user', body: { token } })).status).toBe(204);
		expect(await prisma.pushToken.count({ where: { userId: 'device_user' } })).toBe(1);
		expect((await call('DELETE', '/api/push-tokens', { user: 'device_user', body: { token } })).status).toBe(204);
		expect(await prisma.pushToken.count({ where: { userId: 'device_user' } })).toBe(0);
	});
});

describe('the verse meal', () => {
	it('refuses a verse that does not exist, and says 503 when the server has no credentials', async () => {
		expect((await call('GET', '/api/quran/translation?verseKey=999:1&lang=tr', { user: 'reader' })).status).toBe(
			400
		);
		expect((await call('GET', '/api/quran/translation?verseKey=1:1&lang=tr', { user: 'reader' })).status).toBe(503);
	});
});

describe('feedback', () => {
	it('refuses a message that is too short and files a real one under a CV- reference', async () => {
		expect(
			(await call('POST', '/api/feedback', { user: 'writer', body: { topic: 'BUG', message: 'short' } })).status
		).toBe(400);

		const filed = await call('POST', '/api/feedback', {
			user: 'writer',
			body: { topic: 'IDEA', message: 'A longer message about the app.' }
		});
		expect(filed.status).toBe(201);
		const { reference } = (await filed.json()) as { reference: string };
		expect(reference).toMatch(/^CV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
		expect(await prisma.feedback.count({ where: { userId: 'writer' } })).toBe(1);
	});
});

describe('groups and membership', () => {
	it('refuses a Cevşen group with a seat count it does not offer', async () => {
		const response = await call('POST', '/api/groups', {
			user: 'maker',
			headers: MODERN,
			body: {
				name: 'Yanlış',
				kind: 'CEVSEN',
				spots: 7,
				cycle: 'DAILY',
				splitMode: 'FIXED',
				visibility: 'OPEN',
				reminderTime: '21:00',
				timezone: 'Europe/Istanbul'
			}
		});

		expect(response.status).toBe(400);
	});

	it('shows a private group by id to members only, and lets an outsider in by its code', async () => {
		const group = await createGroup('private_owner', { visibility: 'PRIVATE' });

		expect(
			(await call('GET', `/api/memberships/preview/group/${group.id}`, { user: 'outsider', headers: MODERN }))
				.status
		).toBe(404);
		expect(
			(await call('POST', `/api/memberships/join/${group.id}`, { user: 'outsider', headers: MODERN, body: {} }))
				.status
		).toBe(404);

		const preview = await call('GET', `/api/memberships/preview/code/${group.inviteCode}`, {
			user: 'outsider',
			headers: MODERN
		});
		expect(preview.status).toBe(200);
		expect(
			(
				await call('POST', '/api/memberships/join/code', {
					user: 'outsider',
					headers: MODERN,
					body: { code: group.inviteCode }
				})
			).status
		).toBe(201);
		expect(
			(await call('GET', `/api/memberships/preview/group/${group.id}`, { user: 'outsider', headers: MODERN }))
				.status
		).toBe(200);
	});

	it('lets a member leave and an owner remove a member', async () => {
		const group = await createGroup('team_owner');
		for (const user of ['leaver', 'removed']) {
			const joined = await call('POST', `/api/memberships/join/${group.id}`, { user, headers: MODERN, body: {} });
			expect(joined.status).toBe(201);
		}

		expect(
			(await call('DELETE', `/api/memberships/${group.id}/leave`, { user: 'leaver', headers: MODERN })).status
		).toBe(200);
		// Only the owner removes someone else.
		expect(
			(
				await call('DELETE', `/api/memberships/${group.id}/members/removed`, {
					user: 'leaver',
					headers: MODERN
				})
			).status
		).toBeGreaterThanOrEqual(400);
		expect(
			(
				await call('DELETE', `/api/memberships/${group.id}/members/removed`, {
					user: 'team_owner',
					headers: MODERN
				})
			).status
		).toBe(200);
		expect(
			(await prisma.groupMember.findMany({ where: { groupId: group.id } })).map(member => member.userId)
		).toEqual(['team_owner']);
	});

	it('keeps a Hizb group out of discover for a build that cannot draw it', async () => {
		const hizb = await createGroup('hizb_owner', {
			kind: 'HIZB',
			hizbPlan: 33,
			spots: undefined,
			splitMode: undefined
		});

		const legacy = (await (
			await call('GET', '/api/groups/discover', {
				user: 'browser',
				headers: { 'X-Cuzhane-Kinds': 'CEVSEN,HATIM' }
			})
		).json()) as { id: string }[];
		const modern = (await (
			await call('GET', '/api/groups/discover', { user: 'browser', headers: MODERN })
		).json()) as { id: string }[];

		expect(legacy.map(group => group.id)).not.toContain(hizb.id);
		expect(modern.map(group => group.id)).toContain(hizb.id);
	});

	it('deletes the account’s owned groups with it', async () => {
		const group = await createGroup('leaving_user');

		expect((await call('DELETE', '/api/account', { user: 'leaving_user' })).status).toBe(200);
		expect(await prisma.group.findUnique({ where: { id: group.id } })).toBeNull();
	});

	it('serves the caller’s own reading stats', async () => {
		const response = await call('GET', '/api/profile/stats', { user: 'stats_user' });

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ babsRead: 0, streakDays: 0, last30Days: expect.any(Array) });
	});
});
