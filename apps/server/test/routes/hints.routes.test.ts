import prisma from '@db/prisma';
import { deleteAccountForUser } from '@services/account.service';
import { MAX_SEEN_HINTS } from '@services/hints.service';
import { LEGACY_TOUR_HINT_IDS } from '@utils/legacyTourHints';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

// Clerk replaced by a header, as in `api.routes.test.ts`: `x-test-user` signs a request in.
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

const { createApp } = await import('@app');

let server: Server;
let origin = '';

beforeAll(async () => {
	server = createApp().listen(0);
	await new Promise(resolve => server.once('listening', resolve));
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
	await prisma.hintSeen.deleteMany({});
	await prisma.userSettings.deleteMany({});
});

afterAll(async () => {
	await new Promise(resolve => server.close(resolve));
	await prisma.$disconnect();
});

type HintsBody = { seenIds: string[]; enabled: boolean };

const call = (method: string, path: string, { user, body }: { user?: string; body?: unknown } = {}) =>
	fetch(origin + path, {
		method,
		headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});

const getHints = async (user: string) => {
	const response = await call('GET', '/api/hints', { user });
	expect(response.status).toBe(200);

	return (await response.json()) as HintsBody;
};

const markSeen = (user: string, ids: unknown) => call('POST', '/api/hints/seen', { user, body: { ids } });

describe('the gate', () => {
	it.each([
		['GET', '/api/hints'],
		['POST', '/api/hints/seen'],
		['POST', '/api/hints/reset']
	])('answers 401 to %s %s without a session', async (method, path) => {
		const response = await call(method, path, method === 'POST' ? { body: { ids: ['welcome'] } } : {});

		expect(response.status).toBe(401);
	});
});

describe('GET /api/hints', () => {
	it('is empty and enabled for a new account, without writing a settings row', async () => {
		expect(await getHints('fresh')).toEqual({ seenIds: [], enabled: true });
		expect(await prisma.userSettings.count({ where: { userId: 'fresh' } })).toBe(0);
	});

	it('counts the old tour as seen for an account whose hasSeenTour is set, without duplicates', async () => {
		await prisma.userSettings.create({ data: { userId: 'tourist', hasSeenTour: true } });
		await prisma.hintSeen.createMany({
			data: ['welcome', 'profile.stats'].map(hintId => ({ userId: 'tourist', hintId }))
		});

		const { seenIds } = await getHints('tourist');

		expect([...seenIds].sort()).toEqual([...new Set([...LEGACY_TOUR_HINT_IDS, 'profile.stats'])].sort());
		expect(seenIds).toHaveLength(LEGACY_TOUR_HINT_IDS.length + 1);
		// Finishing the old tour skips the welcome only: every screen hint is still new to them.
		expect(seenIds).not.toContain('home.nextCard');
	});

	it('answers the hintsEnabled switch', async () => {
		await prisma.userSettings.create({ data: { userId: 'quiet', hintsEnabled: false } });

		expect((await getHints('quiet')).enabled).toBe(false);
	});
});

describe('POST /api/hints/seen', () => {
	it('records ids idempotently, duplicates and all, and answers the GET shape', async () => {
		const first = await markSeen('reader', ['welcome', 'reader.map', 'reader.map']);

		expect(first.status).toBe(200);
		expect((await first.json()) as HintsBody).toEqual({ seenIds: ['welcome', 'reader.map'], enabled: true });

		const again = await markSeen('reader', ['reader.map', 'someFutureHint']);

		expect(again.status).toBe(200);
		expect(((await again.json()) as HintsBody).seenIds.sort()).toEqual(['reader.map', 'someFutureHint', 'welcome']);
		expect(await prisma.hintSeen.count({ where: { userId: 'reader' } })).toBe(3);
	});

	it.each([
		['an empty list', []],
		['more than 20 ids', Array.from({ length: 21 }, (_, i) => `hint${i}`)],
		['an id over 64 characters', ['a'.repeat(65)]],
		['an id with a forbidden character', ['reader-map']],
		['an id starting with a capital', ['Reader.map']],
		['an id starting with a digit', ['1reader']],
		['a non-string id', [42]],
		['no list at all', undefined]
	])('refuses %s with 400', async (_label, ids) => {
		const response = await markSeen('picky', ids);

		expect(response.status).toBe(400);
		expect(await prisma.hintSeen.count({ where: { userId: 'picky' } })).toBe(0);
	});

	it('accepts an id of exactly 64 characters', async () => {
		expect((await markSeen('long', ['a'.repeat(64)])).status).toBe(200);
	});

	it(`refuses once an account would go over ${MAX_SEEN_HINTS} rows, but still accepts ones it already has`, async () => {
		await prisma.hintSeen.createMany({
			data: Array.from({ length: MAX_SEEN_HINTS - 1 }, (_, i) => ({ userId: 'hoarder', hintId: `hint${i}` }))
		});

		expect((await markSeen('hoarder', ['last'])).status).toBe(200);

		const over = await markSeen('hoarder', ['oneTooMany']);

		expect(over.status).toBe(400);
		expect((await markSeen('hoarder', ['hint0', 'last'])).status).toBe(200);
		expect(await prisma.hintSeen.count({ where: { userId: 'hoarder' } })).toBe(MAX_SEEN_HINTS);
	});

	it('keeps each account to its own hints', async () => {
		await markSeen('alice', ['reader.map']);

		expect((await getHints('bob')).seenIds).toEqual([]);
		expect((await getHints('alice')).seenIds).toEqual(['reader.map']);
	});

	it('makes an old build see hasSeenTour once the account has used hints', async () => {
		const before = await call('GET', '/api/user-settings', { user: 'upgrader' });
		expect(((await before.json()) as { hasSeenTour: boolean }).hasSeenTour).toBe(false);

		await markSeen('upgrader', ['welcome']);

		const after = await call('GET', '/api/user-settings', { user: 'upgrader' });
		expect(((await after.json()) as { hasSeenTour: boolean }).hasSeenTour).toBe(true);

		const row = await prisma.userSettings.findUniqueOrThrow({ where: { userId: 'upgrader' } });
		expect([row.hasSeenTour, row.hasUsedHints]).toEqual([false, true]);
	});
});

describe('POST /api/hints/reset', () => {
	it('clears every hint but welcome and keeps hasUsedHints', async () => {
		await markSeen('again', ['welcome', 'reader.map', 'cuz.actions']);
		await markSeen('other', ['reader.map']);

		const response = await call('POST', '/api/hints/reset', { user: 'again' });

		expect(response.status).toBe(200);
		expect((await response.json()) as HintsBody).toEqual({ seenIds: ['welcome'], enabled: true });

		const row = await prisma.userSettings.findUniqueOrThrow({ where: { userId: 'again' } });
		expect(row.hasUsedHints).toBe(true);
		expect((await getHints('other')).seenIds).toEqual(['reader.map']);
	});

	it('clears a tour account’s hasSeenTour without giving it welcome back', async () => {
		await prisma.userSettings.create({ data: { userId: 'veteran', hasSeenTour: true, hasUsedHints: true } });
		await markSeen('veteran', ['profile.stats']);

		const response = await call('POST', '/api/hints/reset', { user: 'veteran' });

		expect(((await response.json()) as HintsBody).seenIds).toEqual(['welcome']);

		const row = await prisma.userSettings.findUniqueOrThrow({ where: { userId: 'veteran' } });
		expect([row.hasSeenTour, row.hasUsedHints]).toEqual([false, true]);
		expect((await getHints('veteran')).seenIds).toEqual(['welcome']);
	});

	it('keeps an old build off its demo tour for a tour account that never had a hint marked seen', async () => {
		await prisma.userSettings.create({ data: { userId: 'quiet', hasSeenTour: true } });

		await call('POST', '/api/hints/reset', { user: 'quiet' });

		const row = await prisma.userSettings.findUniqueOrThrow({ where: { userId: 'quiet' } });
		expect([row.hasSeenTour, row.hasUsedHints]).toEqual([false, true]);
		const settings = (await (await call('GET', '/api/user-settings', { user: 'quiet' })).json()) as {
			hasSeenTour: boolean;
		};
		expect(settings.hasSeenTour).toBe(true);
	});

	it('is harmless on an account that never saw anything', async () => {
		const response = await call('POST', '/api/hints/reset', { user: 'blank' });

		expect(response.status).toBe(200);
		expect((await response.json()) as HintsBody).toEqual({ seenIds: [], enabled: true });
	});
});

describe('settings', () => {
	it('patches hintsEnabled and answers it in the settings', async () => {
		const patched = await call('PATCH', '/api/user-settings', { user: 'switcher', body: { hintsEnabled: false } });

		expect(patched.status).toBe(200);
		expect(((await patched.json()) as { hintsEnabled: boolean }).hintsEnabled).toBe(false);
		expect((await getHints('switcher')).enabled).toBe(false);
	});

	it('still accepts an old build’s hasSeenTour: true', async () => {
		const patched = await call('PATCH', '/api/user-settings', { user: 'oldBuild', body: { hasSeenTour: true } });

		expect(patched.status).toBe(200);
		expect(((await patched.json()) as { hasSeenTour: boolean }).hasSeenTour).toBe(true);
		expect((await getHints('oldBuild')).seenIds).toEqual([...LEGACY_TOUR_HINT_IDS]);
	});
});

describe('account deletion', () => {
	it('removes the account’s seen hints and leaves others’', async () => {
		await markSeen('leaving', ['welcome', 'reader.map']);
		await markSeen('staying', ['welcome']);

		await deleteAccountForUser('leaving');

		expect(await prisma.hintSeen.count({ where: { userId: 'leaving' } })).toBe(0);
		expect(await prisma.hintSeen.count({ where: { userId: 'staying' } })).toBe(1);
	});
});
