import { env } from '@config/env';
import prisma from '@db/prisma';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

/*
 * Live reading, end to end: the REST routes through `createApp`, and the socket attached to the
 * same server the way `index.ts` attaches it. Clerk is replaced — a request's `x-test-user` header
 * signs it in, and a socket's token *is* its user id (`bad` fails verification) — and the grace and
 * auth windows are shortened so the timeout paths run in milliseconds.
 */
vi.mock('@clerk/express', () => ({
	clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	getAuth: (req: { get: (name: string) => string | undefined }) => ({ userId: req.get('x-test-user') ?? null }),
	verifyToken: async (token: string) => {
		if (token === 'bad') {
			throw new Error('invalid token');
		}

		return { sub: token };
	},
	clerkClient: { users: { getUser: async () => Promise.reject(new Error('no Clerk in tests')) } }
}));
vi.mock('@utils/memberProfiles', () => ({
	FALLBACK_DISPLAY_NAME: 'Member',
	forgetMemberProfile: () => undefined,
	getMemberProfiles: async (userIds: string[]) =>
		new Map(userIds.map(userId => [userId, { displayName: `Name of ${userId}`, imageUrl: null }]))
}));
vi.mock('@schemas/live.schema', async () => {
	const actual = await vi.importActual<typeof import('@schemas/live.schema')>('@schemas/live.schema');

	return {
		...actual,
		AUTH_TIMEOUT_MS: 150,
		IDLE_AFTER_MS: 2000,
		LEADER_GRACE_MS: 700,
		VOICE_CLOSE_RETRY_MS: [20, 40],
		VOICE_LISTEN_ANSWER_MS: 1000,
		VOICE_SHUTDOWN_MS: 300
	};
});

const { createApp } = await import('@app');
const { attachLiveSockets } = await import('@services/liveSocket.service');
const { deleteAccountForUser } = await import('@services/account.service');
const { stopAllRooms } = await import('@services/liveHub.service');

let server: Server;
let live: { close: () => void };
let origin = '';
let socketUrl = '';

beforeAll(async () => {
	server = createApp().listen(0);
	await new Promise(resolve => server.once('listening', resolve));
	live = attachLiveSockets(server);

	const { port } = server.address() as AddressInfo;

	origin = `http://127.0.0.1:${port}`;
	socketUrl = `ws://127.0.0.1:${port}/api/live-socket`;
});

beforeEach(async () => {
	await prisma.liveSession.deleteMany({});
});

afterAll(async () => {
	live.close();
	await new Promise(resolve => server.close(resolve));
	await prisma.$disconnect();
});

const call = (method: string, path: string, { user, body }: { user?: string; body?: unknown } = {}) =>
	fetch(origin + path, {
		method,
		headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});

const start = async (user: string, kind: 'CEVSEN' | 'QURAN' = 'CEVSEN') => {
	const response = await call('POST', '/api/live', { user, body: { kind } });

	expect(response.status).toBe(201);

	return (await response.json()) as { id: string; code: string; kind: string; isLeader: boolean };
};

type Frame = { t: string; [key: string]: unknown };

/**
 * A socket with a mailbox: every frame it receives is kept, and `next` waits for the first one
 * (from here on) that matches, so a test can say what it expects without racing the server.
 */
const connect = async () => {
	const ws = new WebSocket(socketUrl);
	const frames: Frame[] = [];
	const waiters: { match: (frame: Frame) => boolean; resolve: (frame: Frame) => void }[] = [];
	let cursor = 0;

	ws.on('message', data => {
		const frame = JSON.parse(data.toString()) as Frame;

		frames.push(frame);

		for (const waiter of [...waiters]) {
			if (waiter.match(frame)) {
				waiters.splice(waiters.indexOf(waiter), 1);
				waiter.resolve(frame);
			}
		}
	});

	const closed = new Promise<number>(resolve => ws.on('close', code => resolve(code)));

	await new Promise(resolve => ws.once('open', resolve));

	const next = (t: string, where: (frame: Frame) => boolean = () => true) => {
		const match = (frame: Frame) => frame.t === t && where(frame);
		const index = frames.slice(cursor).findIndex(match);

		if (index !== -1) {
			const frame = frames[cursor + index]!;

			cursor += index + 1;
			return Promise.resolve(frame);
		}

		return new Promise<Frame>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`no "${t}" frame; got ${JSON.stringify(frames)}`)), 2000);

			waiters.push({
				match,
				resolve: frame => {
					clearTimeout(timer);
					cursor = frames.indexOf(frame) + 1;
					resolve(frame);
				}
			});
		});
	};

	const sendFrame = (frame: unknown) => ws.send(JSON.stringify(frame));

	return { closed, frames, next, send: sendFrame, ws };
};

/** A socket signed in as `user` and inside the session with `code`. */
const joinAs = async (user: string, code: string) => {
	const socket = await connect();

	socket.send({ t: 'auth', token: user });
	await socket.next('ready');
	socket.send({ t: 'join', code });
	const snapshot = await socket.next('snapshot');

	return { ...socket, snapshot };
};

const cevsen = (bab: number, f = 0) => ({ k: 'CEVSEN', bab, f });

describe('live reading routes', () => {
	it('starts a session with a code the reader can share', async () => {
		const session = await start('reader');

		expect(session.code).toMatch(/^[A-Z2-9]{8}$/);
		expect(session.kind).toBe('CEVSEN');
		expect(session.isLeader).toBe(true);
	});

	it('shows a session by its code, as typed with or without the dash', async () => {
		const { code } = await start('reader', 'QURAN');
		const response = await call('GET', `/api/live/${code.slice(0, 4)}-${code.slice(4).toLowerCase()}`, {
			user: 'friend'
		});
		const preview = await response.json();

		expect(response.status).toBe(200);
		expect(preview).toMatchObject({
			code,
			followerCount: 0,
			isLeader: false,
			kind: 'QURAN',
			leaderName: 'Name of reader',
			position: null
		});
	});

	it('replaces the reader’s earlier session instead of running two', async () => {
		const first = await start('reader');
		const second = await start('reader', 'QURAN');

		expect(second.code).not.toBe(first.code);
		expect((await call('GET', `/api/live/${first.code}`, { user: 'friend' })).status).toBe(404);
		expect(await prisma.liveSession.count()).toBe(1);
	});

	it('lets only the reader end it', async () => {
		const { code, id } = await start('reader');

		expect((await call('DELETE', `/api/live/${id}`, { user: 'friend' })).status).toBe(404);
		expect((await call('DELETE', `/api/live/${id}`, { user: 'reader' })).status).toBe(200);
		expect((await call('GET', `/api/live/${code}`, { user: 'friend' })).status).toBe(404);
	});

	it('treats a session whose reader has been gone past the window as ended', async () => {
		const { code, id } = await start('reader');

		await prisma.liveSession.update({ where: { id }, data: { heartbeatAt: new Date(Date.now() - 4 * 60_000) } });

		expect((await call('GET', `/api/live/${code}`, { user: 'friend' })).status).toBe(404);
		expect(await prisma.liveSession.count()).toBe(0);
	});

	it('refuses a kind it has no free reader for, and anyone signed out', async () => {
		expect((await call('POST', '/api/live', { user: 'reader', body: { kind: 'HIZB' } })).status).toBe(400);
		expect((await call('POST', '/api/live', { body: { kind: 'CEVSEN' } })).status).toBe(401);
	});
});

describe('live reading socket', () => {
	it('closes a socket that does not sign in', async () => {
		const socket = await connect();

		expect(await socket.closed).toBe(4401);
	});

	it('closes a socket whose token does not verify', async () => {
		const socket = await connect();

		socket.send({ t: 'auth', token: 'bad' });

		expect(await socket.closed).toBe(4401);
	});

	it('tells a socket nothing before it signs in', async () => {
		const { code } = await start('reader');
		const socket = await connect();

		socket.send({ t: 'join', code });

		expect(await socket.closed).toBe(4401);
		expect(socket.frames.some(frame => frame.t === 'snapshot')).toBe(false);
	});

	it('refuses a code that is not live', async () => {
		const socket = await connect();

		socket.send({ t: 'auth', token: 'friend' });
		await socket.next('ready');
		socket.send({ t: 'join', code: 'ZZZZZZZZ' });

		expect(await socket.next('error')).toMatchObject({ code: 'not-found' });
		expect(await socket.closed).toBe(4404);
	});

	it('carries the reader’s place to followers, and only the reader’s', async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);
		const friend = await joinAs('friend', code);

		expect(reader.snapshot).toMatchObject({ role: 'leader', status: 'live', pos: null });
		expect(friend.snapshot).toMatchObject({ role: 'follower', status: 'live' });
		expect(await reader.next('people', frame => (frame.people as unknown[]).length === 2)).toMatchObject({
			people: [
				{ isLeader: true, isYou: true, name: 'Name of reader' },
				{ isLeader: false, isYou: false, name: 'Name of friend' }
			]
		});

		reader.send({ t: 'pos', seq: 1, pos: cevsen(12, 0.4) });
		expect(await friend.next('pos')).toMatchObject({ pos: cevsen(12, 0.4), seq: 1 });

		friend.send({ t: 'pos', seq: 1, pos: cevsen(50) });
		expect(await friend.next('error')).toMatchObject({ code: 'not-leader' });

		reader.send({ t: 'pos', seq: 2, pos: { k: 'QURAN', edition: 'text', cuz: 1, page: 3, f: 0 } });
		expect(await reader.next('error')).toMatchObject({ code: 'wrong-kind' });

		// A frame older than one already sent is late, not new.
		reader.send({ t: 'pos', seq: 3, pos: cevsen(13) });
		reader.send({ t: 'pos', seq: 2, pos: cevsen(99) });
		reader.send({ t: 'pos', seq: 4, pos: cevsen(14) });
		expect(await friend.next('pos')).toMatchObject({ pos: cevsen(13), seq: 2 });
		expect(await friend.next('pos')).toMatchObject({ pos: cevsen(14), seq: 3 });

		reader.ws.close();
		friend.ws.close();
	});

	it('carries the reader’s line to followers, and hands it to a late joiner', async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);
		const friend = await joinAs('friend', code);

		reader.send({ t: 'pos', seq: 1, pos: cevsen(12) });
		reader.send({ t: 'mark', seq: 2, mark: { k: 'CEVSEN', bab: 12, n: 4 }, shown: true });
		expect(await friend.next('mark')).toMatchObject({ mark: { k: 'CEVSEN', bab: 12, n: 4 }, shown: true });

		// Scrolled off the reader's own screen: still there, but followers go back to the page.
		reader.send({ t: 'mark', seq: 3, mark: { k: 'CEVSEN', bab: 12, n: 4 }, shown: false });
		expect(await friend.next('mark')).toMatchObject({ shown: false });

		const late = await joinAs('late', code);

		expect(late.snapshot).toMatchObject({ mark: { k: 'CEVSEN', bab: 12, n: 4 }, markShown: false });

		reader.ws.close();
		friend.ws.close();
		late.ws.close();
	});

	it('takes a line only from the reader, of the session’s kind and in the right shape', async () => {
		const { code } = await start('reader', 'QURAN');
		const reader = await joinAs('reader', code);
		const friend = await joinAs('friend', code);
		const verse = { k: 'QURAN', edition: 'text', cuz: 1, page: 3, verse: '2:10' };
		const line = { k: 'QURAN', edition: 'husrev', cuz: 1, page: 3, line: 7 };

		friend.send({ t: 'mark', seq: 1, mark: verse, shown: true });
		expect(await friend.next('error')).toMatchObject({ code: 'not-leader' });

		reader.send({ t: 'mark', seq: 1, mark: { k: 'CEVSEN', bab: 1, n: 1 }, shown: true });
		expect(await reader.next('error')).toMatchObject({ code: 'wrong-kind' });

		// A typeset mark names a verse, a Hüsrev mark one of the page's fifteen lines — never the other way.
		reader.send({ t: 'mark', seq: 2, mark: { ...verse, verse: undefined, line: 7 }, shown: true });
		expect(await reader.next('error')).toMatchObject({ code: 'bad-frame' });
		reader.send({ t: 'mark', seq: 3, mark: { ...line, line: 16 }, shown: true });
		expect(await reader.next('error')).toMatchObject({ code: 'bad-frame' });

		reader.send({ t: 'mark', seq: 4, mark: line, shown: true });
		expect(await friend.next('mark')).toMatchObject({ mark: line });

		reader.ws.close();
		friend.ws.close();
	});

	it('lets the line go when the reader clears it or moves to another page', async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);
		const friend = await joinAs('friend', code);

		reader.send({ t: 'pos', seq: 1, pos: cevsen(12) });
		reader.send({ t: 'mark', seq: 2, mark: { k: 'CEVSEN', bab: 12, n: 4 }, shown: true });
		await friend.next('mark');

		reader.send({ t: 'mark', seq: 3, mark: null, shown: false });
		expect(await friend.next('mark')).toMatchObject({ mark: null });

		reader.send({ t: 'mark', seq: 4, mark: { k: 'CEVSEN', bab: 12, n: 5 }, shown: true });
		await friend.next('mark');
		reader.send({ t: 'pos', seq: 5, pos: cevsen(13) });
		await friend.next('pos');

		// A bab turn ends the line even if the reader's app never says so.
		const late = await joinAs('late', code);

		expect(late.snapshot).toMatchObject({ mark: null });

		reader.ws.close();
		friend.ws.close();
		late.ws.close();
	});

	it('hands a late joiner the current place at once', async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);

		reader.send({ t: 'pos', seq: 1, pos: cevsen(33, 0.5) });
		await new Promise(resolve => setTimeout(resolve, 100));

		const late = await joinAs('late', code);

		expect(late.snapshot).toMatchObject({ pos: cevsen(33, 0.5), seq: 1, status: 'live' });
		// The preview a joiner sees before the socket carries the same place.
		expect(await (await call('GET', `/api/live/${code}`, { user: 'other' })).json()).toMatchObject({
			followerCount: 1,
			position: cevsen(33, 0.5)
		});

		reader.ws.close();
		late.ws.close();
	});

	it('waits for a reader who dropped out, then ends the session', async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);
		const friend = await joinAs('friend', code);

		reader.ws.close();

		expect(await friend.next('status')).toMatchObject({ status: 'away' });
		expect(await friend.next('ended')).toMatchObject({ reason: 'leader-left' });
		expect(await friend.closed).toBe(4410);
		expect(await prisma.liveSession.count()).toBe(0);
	});

	it('lets a reader who comes back in time carry on', async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);
		const friend = await joinAs('friend', code);

		reader.ws.close();
		expect(await friend.next('status')).toMatchObject({ status: 'away' });

		const back = await joinAs('reader', code);

		expect(await friend.next('status')).toMatchObject({ status: 'live' });
		// Past the grace window the reader left in: coming back cancelled it.
		await new Promise(resolve => setTimeout(resolve, 900));
		expect(friend.frames.some(frame => frame.t === 'ended')).toBe(false);

		back.ws.close();
		friend.ws.close();
	});

	it('ends a session whose reader has not moved for the idle window', async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);
		const friend = await joinAs('friend', code);

		// A move part-way through the window starts it again.
		await new Promise(resolve => setTimeout(resolve, 1200));
		reader.send({ t: 'pos', seq: 1, pos: cevsen(2) });
		expect(await friend.next('pos')).toMatchObject({ pos: cevsen(2) });
		await new Promise(resolve => setTimeout(resolve, 1200));
		expect(friend.frames.some(frame => frame.t === 'ended')).toBe(false);

		// Then nothing: the session ends for everyone, the reader included.
		expect(await friend.next('ended')).toMatchObject({ reason: 'idle' });
		expect(await reader.next('ended')).toMatchObject({ reason: 'idle' });
		expect(await friend.closed).toBe(4410);
		expect(await prisma.liveSession.count()).toBe(0);
	});

	it('tells followers when the reader ends it', async () => {
		const { code, id } = await start('reader');
		const friend = await joinAs('friend', code);

		await call('DELETE', `/api/live/${id}`, { user: 'reader' });

		expect(await friend.next('ended')).toMatchObject({ reason: 'ended' });
		expect(await friend.closed).toBe(4410);
	});

	it('ends the reader’s session with their account', async () => {
		const { code } = await start('reader');
		const friend = await joinAs('friend', code);

		await deleteAccountForUser('reader');

		expect(await friend.next('ended')).toMatchObject({ reason: 'ended' });
		expect(await prisma.liveSession.count()).toBe(0);
	});

	it('takes a follower out of the session with their account', async () => {
		const { code } = await start('host-of-gone');
		const gone = await joinAs('gone-follower', code);

		await deleteAccountForUser('gone-follower');

		expect(await gone.closed).toBe(4401);
	});

	it('meters code guesses per person, across reconnects', async () => {
		// A refused code closes the socket; a guesser reconnects and tries the next one.
		for (let guess = 0; guess < 20; guess++) {
			const socket = await connect();

			socket.send({ t: 'auth', token: 'guesser' });
			await socket.next('ready');
			socket.send({ t: 'join', code: 'ZZZZZZZZ' });
			expect(await socket.closed).toBe(4404);
		}

		const socket = await connect();

		socket.send({ t: 'auth', token: 'guesser' });
		await socket.next('ready');
		socket.send({ t: 'join', code: 'ZZZZZZZZ' });

		expect(await socket.next('error')).toMatchObject({ code: 'too-many' });
		expect(await socket.closed).toBe(4429);
	});

	it('caps sockets that have not signed in from one address', async () => {
		const address = { headers: { 'x-forwarded-for': '203.0.113.7' } };
		const open = () =>
			new Promise<{ status: number; ws: WebSocket }>(resolve => {
				const ws = new WebSocket(socketUrl, address);

				ws.on('unexpected-response', (_request, response) => resolve({ status: response.statusCode ?? 0, ws }));
				ws.on('error', () => undefined);
				ws.on('open', () => resolve({ status: 101, ws }));
			});
		const waiting = await Promise.all(Array.from({ length: 100 }, open));

		expect(waiting.every(socket => socket.status === 101)).toBe(true);
		expect((await open()).status).toBe(503);

		// Another address is not held to this one's count.
		const elsewhere = await connect();

		elsewhere.send({ t: 'auth', token: 'from-elsewhere' });
		expect(await elsewhere.next('ready')).toMatchObject({ t: 'ready' });
		elsewhere.ws.close();

		// Once they sign in or time out, the address may open sockets again.
		await Promise.all(waiting.map(socket => new Promise(resolve => socket.ws.once('close', resolve))));
		expect((await open()).status).toBe(101);
	});

	it('closes a socket that sends an oversized frame', async () => {
		const socket = await connect();

		socket.ws.send('x'.repeat(4096));

		expect(await socket.closed).toBe(1009);
	});
});

/*
 * The reader's voice. **Cloudflare is never called**: `fetch` to its API is answered by a fake that
 * keeps every call, and everything else (these tests' own requests) goes through. Each test has
 * its own people, so the per-person rate limits never carry from one test into the next.
 */
describe('live voice', () => {
	const CLOUDFLARE = 'https://rtc.live.cloudflare.com/v1';
	const CONFIG = {
		CLOUDFLARE_REALTIME_APP_ID: 'app',
		CLOUDFLARE_REALTIME_APP_TOKEN: 'app-token',
		CLOUDFLARE_TURN_KEY_ID: 'turn-key',
		CLOUDFLARE_TURN_KEY_TOKEN: 'turn-token'
	};
	const ICE_SERVERS = [{ urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c' }];
	type CloudflareCall = { method: string; path: string; token: string; body: Record<string, unknown> };

	let calls: CloudflareCall[] = [];
	/** The Cloudflare sessions this test made — an earlier test's room ending now closes one of its own. */
	let made = new Set<string>();
	/** Every call fails, or those whose path matches. */
	let failing: boolean | ((path: string) => boolean) = false;
	/** Calls held until the test lets them go — the first call matching each, in order. */
	let holds: { match: (path: string) => boolean; released: Promise<void> }[] = [];
	/** A test's own answer for a call, in place of the usual one. */
	let respond: ((path: string) => Response | undefined) | null = null;
	let sessions = 0;
	let people = 0;

	const json = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

	/** Holds the next Cloudflare call matching `match`; the returned function lets it answer. */
	const hold = (match: (path: string) => boolean) => {
		let release = () => {};
		const released = new Promise<void>(resolve => (release = resolve));

		holds.push({ match, released });

		return release;
	};

	const fakeCloudflare = async (path: string, init: RequestInit) => {
		// As the real API: opening a session takes no body at all — even `{}` is a 400.
		if (path.endsWith('/sessions/new') && init.body !== undefined) {
			return json({ errorCode: 'decoding_error', errorDescription: 'Body JSON validation error' }, 400);
		}

		const body = (init.body === undefined ? {} : JSON.parse(String(init.body))) as Record<string, unknown>;
		const closing = /^\/apps\/app\/sessions\/([^/]+)\/tracks\/close$/.exec(path);

		if (closing && !made.has(closing[1]!)) {
			return json({});
		}

		calls.push({
			body,
			method: init.method ?? 'GET',
			path,
			token: String((init.headers as Record<string, string>).Authorization)
		});

		const held = holds.find(entry => entry.match(path));

		if (held) {
			holds.splice(holds.indexOf(held), 1);
			await held.released;
		}

		if (failing === true || (typeof failing === 'function' && failing(path))) {
			return json({ errorCode: 'internal_error' }, 500);
		}

		const own = respond?.(path);

		if (own) {
			return own;
		}

		if (path.endsWith('/generate-ice-servers')) {
			return json({ iceServers: ICE_SERVERS }, 201);
		}

		if (path.endsWith('/sessions/new')) {
			sessions += 1;
			made.add(`cf-${sessions}`);
			return json({ sessionId: `cf-${sessions}` });
		}

		if (path.endsWith('/tracks/new')) {
			const offer = body.sessionDescription as { sdp: string } | undefined;

			return offer
				? json({
						sessionDescription: { sdp: `answer to ${offer.sdp}`, type: 'answer' },
						tracks: [{ mid: '0' }]
				  })
				: json({
						requiresImmediateRenegotiation: true,
						sessionDescription: { sdp: 'cloudflare offer', type: 'offer' },
						tracks: [{ mid: '0', trackName: 'voice' }]
				  });
		}

		return json({});
	};

	const closes = () => calls.filter(c => c.path.endsWith('/tracks/close'));

	/** Waits for something that happens on the server after the frame that announces it. */
	const until = async (check: () => boolean) => {
		const started = Date.now();

		while (!check()) {
			if (Date.now() - started > 2000) {
				throw new Error('timed out');
			}

			await new Promise(resolve => setTimeout(resolve, 10));
		}
	};

	/*
	 * Unconfigured between tests: a room from this block that ends later — after the last test,
	 * when `fetch` is real again — stops at the missing config and never reaches Cloudflare.
	 */
	afterEach(() => {
		Object.assign(env, Object.fromEntries(Object.keys(CONFIG).map(key => [key, undefined])));
	});

	beforeEach(() => {
		calls = [];
		made = new Set();
		failing = false;
		holds = [];
		respond = null;
		Object.assign(env, CONFIG);

		const realFetch = globalThis.fetch;

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
			const url = String(input);

			return url.startsWith(CLOUDFLARE)
				? fakeCloudflare(url.slice(CLOUDFLARE.length), init ?? {})
				: realFetch(input, init);
		});
	});

	/** A fresh reader with a session, both of them on the socket, and a follower. */
	const room = async () => {
		people += 1;

		const readerId = `voice-reader-${people}`;
		const friendId = `voice-friend-${people}`;
		const session = await start(readerId);
		const reader = await joinAs(readerId, session.code);
		const friend = await joinAs(friendId, session.code);

		return { friend, friendId, reader, readerId, session };
	};

	const voiceOn = (user: string, sessionId: string, body: unknown = { sdp: 'reader offer', mid: '0' }) =>
		call('POST', `/api/live/${sessionId}/voice`, { user, body });

	const listen = (user: string, sessionId: string) => call('POST', `/api/live/${sessionId}/voice/listen`, { user });

	const answer = (user: string, sessionId: string, listenerSessionId: string) =>
		call('PUT', `/api/live/${sessionId}/voice/listen`, {
			user,
			body: { listenerSessionId, sdp: 'listener answer' }
		});

	const stopListening = (user: string, sessionId: string, listenerSessionId: string) =>
		call('DELETE', `/api/live/${sessionId}/voice/listen`, { user, body: { listenerSessionId } });

	it('lets the reader turn voice on, and tells the whole room', async () => {
		const { friend, reader, readerId, session } = await room();

		expect(reader.snapshot).toMatchObject({ voice: 'off' });
		expect(friend.snapshot).toMatchObject({ voice: 'off' });

		const response = await voiceOn(readerId, session.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			answer: { sdp: 'answer to reader offer', type: 'answer' },
			iceServers: ICE_SERVERS
		});
		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'on' });
		expect(await reader.next('voice')).toEqual({ t: 'voice', voice: 'on' });

		// The track goes to Cloudflare with the app token; the TURN credentials with the TURN token.
		expect(calls.find(c => c.path.endsWith('/tracks/new'))).toEqual({
			body: {
				sessionDescription: { sdp: 'reader offer', type: 'offer' },
				tracks: [{ location: 'local', mid: '0', trackName: 'voice' }]
			},
			method: 'POST',
			path: `/apps/app/sessions/cf-${sessions}/tracks/new`,
			token: 'Bearer app-token'
		});
		expect(calls.find(c => c.path.endsWith('/generate-ice-servers'))).toMatchObject({
			body: { ttl: 4 * 60 * 60 },
			path: '/turn/keys/turn-key/credentials/generate-ice-servers',
			token: 'Bearer turn-token'
		});

		// A late joiner sees it at once.
		const late = await joinAs(`late-${people}`, session.code);

		expect(late.snapshot).toMatchObject({ voice: 'on' });

		reader.ws.close();
		friend.ws.close();
		late.ws.close();
	});

	it('lets a follower in the room listen, and answer Cloudflare’s offer', async () => {
		const { friend, friendId, reader, readerId, session } = await room();

		await voiceOn(readerId, session.id);
		const readerSession = `cf-${sessions}`;

		const response = await listen(friendId, session.id);
		const listening = (await response.json()) as { listenerSessionId: string };

		expect(response.status).toBe(200);
		expect(listening).toEqual({
			iceServers: ICE_SERVERS,
			listenerSessionId: `cf-${sessions}`,
			offer: { sdp: 'cloudflare offer', type: 'offer' }
		});
		expect(calls.filter(c => c.path.endsWith('/tracks/new')).at(-1)?.body).toEqual({
			tracks: [{ location: 'remote', sessionId: readerSession, trackName: 'voice' }]
		});

		const answered = await answer(friendId, session.id, listening.listenerSessionId);

		expect(answered.status).toBe(200);
		expect(await answered.json()).toEqual({ success: true });
		expect(calls.at(-1)).toEqual({
			body: { sessionDescription: { sdp: 'listener answer', type: 'answer' } },
			method: 'PUT',
			path: `/apps/app/sessions/${listening.listenerSessionId}/renegotiate`,
			token: 'Bearer app-token'
		});

		reader.ws.close();
		friend.ws.close();
	});

	it('lets only the reader, connected on the socket, turn voice on', async () => {
		const { friend, friendId, reader, readerId, session } = await room();

		expect((await voiceOn(readerId, 'no-such-session')).status).toBe(404);
		expect((await voiceOn(friendId, session.id)).status).toBe(403);
		expect((await voiceOn(readerId, session.id, { sdp: 'x'.repeat(16_001), mid: '0' })).status).toBe(400);
		expect((await voiceOn(readerId, session.id, { sdp: 'offer', mid: 'x'.repeat(17) })).status).toBe(400);

		// The reader's own session, but no socket in it: there is no room to announce voice in.
		reader.ws.close();
		await friend.next('status', frame => frame.status === 'away');
		expect((await voiceOn(readerId, session.id)).status).toBe(403);
		expect(calls).toHaveLength(0);

		friend.ws.close();
	});

	it('answers "unavailable" when Cloudflare is not configured, and live reading carries on', async () => {
		const { friend, friendId, reader, readerId, session } = await room();

		Object.assign(env, { CLOUDFLARE_TURN_KEY_TOKEN: undefined });

		expect((await voiceOn(readerId, session.id)).status).toBe(503);
		expect((await listen(friendId, session.id)).status).toBe(503);
		expect(calls).toHaveLength(0);

		reader.send({ t: 'pos', seq: 1, pos: cevsen(5) });
		expect(await friend.next('pos')).toMatchObject({ pos: cevsen(5) });

		reader.ws.close();
		friend.ws.close();
	});

	it('leaves voice off when Cloudflare fails', async () => {
		const { friend, friendId, reader, readerId, session } = await room();

		failing = true;

		expect((await voiceOn(readerId, session.id)).status).toBe(502);
		expect((await listen(friendId, session.id)).status).toBe(409);
		expect(friend.frames.some(frame => frame.t === 'voice')).toBe(false);

		reader.ws.close();
		friend.ws.close();
	});

	it('lets only the reader turn voice off, and closes the track at Cloudflare', async () => {
		const { friend, friendId, reader, readerId, session } = await room();

		await voiceOn(readerId, session.id);
		const readerSession = `cf-${sessions}`;
		await friend.next('voice');

		expect((await call('DELETE', '/api/live/no-such-session/voice', { user: readerId })).status).toBe(404);
		expect((await call('DELETE', `/api/live/${session.id}/voice`, { user: friendId })).status).toBe(403);

		const response = await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'off' });
		expect(closes()).toEqual([
			{
				body: { force: true, tracks: [{ mid: '0' }] },
				method: 'PUT',
				path: `/apps/app/sessions/${readerSession}/tracks/close`,
				token: 'Bearer app-token'
			}
		]);

		// Off already: nothing to close, nothing to announce.
		expect((await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId })).status).toBe(200);
		expect(closes()).toHaveLength(1);

		reader.ws.close();
		friend.ws.close();
	});

	it('lets only a follower in the room listen, and only while voice is not off', async () => {
		const { friend, friendId, reader, readerId, session } = await room();

		expect((await listen(friendId, session.id)).status).toBe(409);

		await voiceOn(readerId, session.id);

		expect((await listen(friendId, 'no-such-session')).status).toBe(404);
		// A session id alone is not enough: someone who is not on the socket in this room.
		expect((await listen(`outsider-${people}`, session.id)).status).toBe(403);
		// The reader is never a listener of their own voice.
		expect((await listen(readerId, session.id)).status).toBe(403);

		// Paused still has a track to listen to.
		reader.send({ t: 'voice', seq: 1, state: 'paused' });
		await friend.next('voice', frame => frame.voice === 'paused');
		expect((await listen(friendId, session.id)).status).toBe(200);

		reader.ws.close();
		friend.ws.close();
	});

	it('takes an answer only from the person the listener session was made for', async () => {
		const { friend, friendId, reader, readerId, session } = await room();
		const other = await joinAs(`other-${people}`, session.code);

		await voiceOn(readerId, session.id);
		const { listenerSessionId } = (await (await listen(friendId, session.id)).json()) as {
			listenerSessionId: string;
		};

		expect((await answer(friendId, 'no-such-session', listenerSessionId)).status).toBe(404);
		expect((await answer(`other-${people}`, session.id, listenerSessionId)).status).toBe(403);
		expect((await answer(friendId, session.id, 'cf-unknown')).status).toBe(403);

		// Voice off forgets every listener session.
		await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId });
		expect((await answer(friendId, session.id, listenerSessionId)).status).toBe(403);

		reader.ws.close();
		friend.ws.close();
		other.ws.close();
	});

	it('replaces the track when the reader starts again, and has listeners listen again', async () => {
		const { friend, friendId, reader, readerId, session } = await room();

		await voiceOn(readerId, session.id);
		const first = `cf-${sessions}`;
		await friend.next('voice');
		const { listenerSessionId } = (await (await listen(friendId, session.id)).json()) as {
			listenerSessionId: string;
		};

		await voiceOn(readerId, session.id);

		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'on' });
		expect(closes().map(c => c.path)).toEqual([`/apps/app/sessions/${first}/tracks/close`]);
		expect((await answer(friendId, session.id, listenerSessionId)).status).toBe(403);

		reader.ws.close();
		friend.ws.close();
	});

	it('takes the voice frame only from the reader, and only while voice is on or paused', async () => {
		const { friend, reader, readerId, session } = await room();

		friend.send({ t: 'voice', seq: 1, state: 'paused' });
		expect(await friend.next('error')).toMatchObject({ code: 'not-leader' });

		// Off: the reader's app cannot turn it on this way.
		reader.send({ t: 'voice', seq: 1, state: 'on' });
		reader.send({ t: 'pos', seq: 2, pos: cevsen(3) });
		await friend.next('pos');
		expect(friend.frames.some(frame => frame.t === 'voice')).toBe(false);

		reader.send({ t: 'voice', seq: 3, state: 'paused' });
		reader.send({ t: 'voice', seq: 4, state: 'paused' });
		reader.send({ t: 'voice', seq: 5, state: 'on' });
		await voiceOn(readerId, session.id);
		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'on' });

		reader.send({ t: 'voice', seq: 6, state: 'paused' });
		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'paused' });
		expect(await reader.next('voice', frame => frame.voice === 'paused')).toBeTruthy();
		// The same state twice is one change.
		reader.send({ t: 'voice', seq: 7, state: 'paused' });
		reader.send({ t: 'voice', seq: 8, state: 'on' });
		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'on' });

		reader.send({ t: 'voice', seq: 9, state: 'bad' });
		expect(await reader.next('error')).toMatchObject({ code: 'bad-frame' });

		reader.ws.close();
		friend.ws.close();
	});

	it('pauses the voice while the reader’s socket is away, until their app says it is back', async () => {
		const { friend, reader, readerId, session } = await room();

		await voiceOn(readerId, session.id);
		await friend.next('voice');

		reader.ws.close();
		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'paused' });

		const back = await joinAs(readerId, session.code);

		expect(back.snapshot).toMatchObject({ voice: 'paused' });
		back.send({ t: 'voice', seq: 1, state: 'on' });
		expect(await friend.next('voice')).toEqual({ t: 'voice', voice: 'on' });
		expect(closes()).toHaveLength(0);

		back.ws.close();
		friend.ws.close();
	});

	it('closes the track when the reader ends the session or starts another', async () => {
		const ended = await room();

		await voiceOn(ended.readerId, ended.session.id);
		await call('DELETE', `/api/live/${ended.session.id}`, { user: ended.readerId });
		await ended.friend.next('ended');
		await until(() => closes().length === 1);

		const replaced = await room();

		await voiceOn(replaced.readerId, replaced.session.id);
		await start(replaced.readerId, 'QURAN');
		expect(await replaced.friend.next('ended')).toMatchObject({ reason: 'replaced' });
		await until(() => closes().length === 2);
	});

	it('closes the track when the reader does not come back', async () => {
		const { friend, reader, readerId, session } = await room();

		await voiceOn(readerId, session.id);
		reader.ws.close();

		expect(await friend.next('ended')).toMatchObject({ reason: 'leader-left' });
		await until(() => closes().length === 1);
	});

	it('closes the track when the session ends idle', async () => {
		const { friend, reader, readerId, session } = await room();

		await voiceOn(readerId, session.id);
		// The idle window is as long as `next` waits; most of it passes here first.
		await new Promise(resolve => setTimeout(resolve, 1200));

		expect(await friend.next('ended')).toMatchObject({ reason: 'idle' });
		await until(() => closes().length === 1);

		reader.ws.close();
	});

	it('closes the track when the session runs out, even if Cloudflare fails', async () => {
		people += 1;

		const readerId = `voice-reader-${people}`;
		const session = await start(readerId);

		// Started just under four hours ago: the room's expiry is a moment away.
		await prisma.liveSession.update({
			where: { id: session.id },
			data: { startedAt: new Date(Date.now() - 4 * 60 * 60_000 + 800) }
		});

		const reader = await joinAs(readerId, session.code);

		await voiceOn(readerId, session.id);
		failing = true;

		expect(await reader.next('ended')).toMatchObject({ reason: 'expired' });
		await until(() => closes().length === 1);
	});

	it('limits how often a person may turn voice on and off, and listen', async () => {
		people += 1;

		const flooder = `voice-flood-${people}`;
		const statuses = [];

		for (let attempt = 0; attempt < 21; attempt++) {
			statuses.push((await call('DELETE', '/api/live/no-such-session/voice', { user: flooder })).status);
		}

		expect(statuses.slice(0, 20).every(status => status === 404)).toBe(true);
		expect(statuses[20]).toBe(429);

		// Listening hands out relay credentials: twenty an hour, counted with starting voice — a
		// person fresh to the minute's voice limit is refused voice once listening has used them up.
		const minter = `voice-turn-flood-${people}`;
		const listens = [];

		for (let attempt = 0; attempt < 21; attempt++) {
			listens.push((await listen(minter, 'no-such-session')).status);
		}

		expect(listens.slice(0, 20).every(status => status === 404)).toBe(true);
		expect(listens[20]).toBe(429);
		expect((await call('POST', '/api/live/no-such-session/voice', { user: minter })).status).toBe(429);

		// The listening calls that hand out nothing still have the minute's own limit.
		const answerer = `voice-answer-flood-${people}`;
		const answers = [];

		for (let attempt = 0; attempt < 31; attempt++) {
			answers.push((await answer(answerer, 'no-such-session', 'cf-1')).status);
		}

		expect(answers.slice(0, 30).every(status => status !== 429)).toBe(true);
		expect(answers[30]).toBe(429);
		expect((await stopListening(answerer, 'no-such-session', 'cf-1')).status).toBe(429);
	});

	describe('who is listening', () => {
		/** Listens and answers, as the app does: from then on the person is shown as listening. */
		const listenFully = async (user: string, sessionId: string) => {
			const { listenerSessionId } = (await (await listen(user, sessionId)).json()) as {
				listenerSessionId: string;
			};

			expect((await answer(user, sessionId, listenerSessionId)).status).toBe(200);

			return listenerSessionId;
		};

		/** The next list in which `user` is shown listening (or not). */
		const listed = (socket: Awaited<ReturnType<typeof joinAs>>, user: string, isListening: boolean) =>
			socket.next('people', frame =>
				(frame.people as { name: string; isListening: boolean }[]).some(
					person => person.name === `Name of ${user}` && person.isListening === isListening
				)
			);

		/*
		 * The list goes out at most once a second, so these tests outlast the shortened idle window:
		 * the reader keeps moving, as a reader reading aloud would.
		 */
		const reading = (reader: Awaited<ReturnType<typeof joinAs>>) => {
			let seq = 100;
			const timer = setInterval(
				() => reader.send({ t: 'pos', seq: (seq += 1), pos: cevsen(1, seq / 10_000) }),
				400
			);

			return () => clearInterval(timer);
		};

		it('shows a follower listening once they answer, and not once they stop', async () => {
			const { friend, friendId, reader, readerId, session } = await room();
			const stop = reading(reader);

			expect(friend.snapshot.people).toEqual([
				{ isLeader: true, isListening: false, isYou: false, name: `Name of ${readerId}` },
				{ isLeader: false, isListening: false, isYou: true, name: `Name of ${friendId}` }
			]);

			await voiceOn(readerId, session.id);
			const listenerSessionId = await listenFully(friendId, session.id);

			expect(await listed(reader, friendId, true)).toBeTruthy();
			// A late joiner sees it in the snapshot.
			const late = await joinAs(`late-${people}`, session.code);

			expect(late.snapshot.people).toContainEqual({
				isLeader: false,
				isListening: true,
				isYou: false,
				name: `Name of ${friendId}`
			});

			// Only its own person may stop a listener session.
			expect((await stopListening(`late-${people}`, session.id, listenerSessionId)).status).toBe(403);
			expect((await stopListening(friendId, session.id, '')).status).toBe(400);

			const stopped = await stopListening(friendId, session.id, listenerSessionId);

			expect(stopped.status).toBe(200);
			expect(await stopped.json()).toEqual({ success: true });
			expect(await listed(reader, friendId, false)).toBeTruthy();

			// Stopped already, unknown, or in a session that is not there: all stopped.
			expect((await stopListening(friendId, session.id, listenerSessionId)).status).toBe(200);
			expect((await stopListening(friendId, session.id, 'cf-unknown')).status).toBe(200);
			expect((await stopListening(friendId, 'no-such-session', listenerSessionId)).status).toBe(200);
			// Nothing is closed at Cloudflare: the app closes its own connection.
			expect(closes()).toHaveLength(0);

			stop();
			reader.ws.close();
			friend.ws.close();
			late.ws.close();
		});

		it('stops showing listeners when voice goes off or is started again', async () => {
			const { friend, friendId, reader, readerId, session } = await room();
			const stop = reading(reader);

			await voiceOn(readerId, session.id);
			await listenFully(friendId, session.id);
			await listed(reader, friendId, true);

			await voiceOn(readerId, session.id);
			expect(await listed(reader, friendId, false)).toBeTruthy();

			await listenFully(friendId, session.id);
			await listed(reader, friendId, true);

			await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId });
			expect(await listed(reader, friendId, false)).toBeTruthy();

			stop();
			reader.ws.close();
			friend.ws.close();
		});

		it('keeps one entry per person, listening while any of their phones is, until they leave on all', async () => {
			const { friend, friendId, reader, readerId, session } = await room();
			const stop = reading(reader);
			const secondPhone = await joinAs(friendId, session.code);

			await voiceOn(readerId, session.id);
			await listenFully(friendId, session.id);

			const shown = await listed(reader, friendId, true);

			expect((shown.people as unknown[]).length).toBe(2);

			// One phone leaves: still in the room on the other, still listening.
			friend.ws.close();
			await new Promise(resolve => setTimeout(resolve, 1200));
			expect(reader.frames.filter(frame => frame.t === 'people').at(-1)?.people).toContainEqual(
				expect.objectContaining({ isListening: true, name: `Name of ${friendId}` })
			);

			// The last one leaves: gone from the list, and from the listeners.
			secondPhone.ws.close();
			await reader.next('people', frame => (frame.people as unknown[]).length === 1);
			expect((await answer(friendId, session.id, `cf-${sessions}`)).status).toBe(403);

			stop();
			reader.ws.close();
		});

		it('forgets listener sessions never answered, and caps those waiting per person', async () => {
			const { friend, friendId, reader, readerId, session } = await room();
			const stop = reading(reader);

			await voiceOn(readerId, session.id);

			const waiting = [];

			for (let attempt = 0; attempt < 4; attempt++) {
				const response = await listen(friendId, session.id);

				expect(response.status).toBe(200);
				waiting.push(((await response.json()) as { listenerSessionId: string }).listenerSessionId);
			}

			expect((await listen(friendId, session.id)).status).toBe(429);

			// Past the answer window (shortened here): forgotten, and their slots free again.
			await new Promise(resolve => setTimeout(resolve, 1100));
			expect((await answer(friendId, session.id, waiting[0]!)).status).toBe(403);
			expect((await listen(friendId, session.id)).status).toBe(200);

			stop();
			reader.ws.close();
			friend.ws.close();
		});

		it('takes the slot before Cloudflare is asked, so listens sent together cannot pass the cap', async () => {
			const { friend, friendId, reader, readerId, session } = await room();

			await voiceOn(readerId, session.id);

			const releases = Array.from({ length: 4 }, () => hold(path => path.endsWith('/tracks/new')));
			const pending = Array.from({ length: 5 }, () => listen(friendId, session.id));

			await until(() => calls.filter(c => c.path.endsWith('/tracks/new')).length === 5);
			releases.forEach(release => release());

			const statuses = (await Promise.all(pending)).map(response => response.status).sort();

			expect(statuses).toEqual([200, 200, 200, 200, 429]);

			reader.ws.close();
			friend.ws.close();
		});
	});

	describe('when Cloudflare is slow or fails', () => {
		const tracksNew = (path: string) => path.endsWith('/tracks/new');

		it('never turns voice on for a start that turning it off overtook', async () => {
			const { friend, reader, readerId, session } = await room();
			const release = hold(tracksNew);
			const pending = voiceOn(readerId, session.id);

			await until(() => calls.some(c => tracksNew(c.path)));
			const overtaken = `cf-${sessions}`;

			expect((await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId })).status).toBe(200);
			release();

			expect((await pending).status).toBe(409);
			await until(() => closes().some(c => c.path.includes(`/${overtaken}/`)));
			expect(friend.frames.some(frame => frame.t === 'voice')).toBe(false);
			expect((await joinAs(`late-${people}`, session.code)).snapshot).toMatchObject({ voice: 'off' });

			reader.ws.close();
			friend.ws.close();
		});

		it('never lets a slow start overwrite a newer one', async () => {
			const { friend, friendId, reader, readerId, session } = await room();
			const release = hold(tracksNew);
			const slow = voiceOn(readerId, session.id);

			await until(() => calls.some(c => tracksNew(c.path)));
			const overtaken = `cf-${sessions}`;

			expect((await voiceOn(readerId, session.id)).status).toBe(200);
			const current = `cf-${sessions}`;

			release();

			expect((await slow).status).toBe(409);
			await until(() => closes().length === 1);
			expect(closes()[0]!.path).toBe(`/apps/app/sessions/${overtaken}/tracks/close`);

			// The newer track is the one followers hear.
			expect((await listen(friendId, session.id)).status).toBe(200);
			expect(calls.filter(c => tracksNew(c.path)).at(-1)?.body).toMatchObject({
				tracks: [{ sessionId: current }]
			});

			reader.ws.close();
			friend.ws.close();
		});

		it('drops a start overtaken by the reader’s socket leaving, even once it is back', async () => {
			const { friend, reader, readerId, session } = await room();
			const release = hold(tracksNew);
			const pending = voiceOn(readerId, session.id);

			await until(() => calls.some(c => tracksNew(c.path)));
			reader.ws.close();
			await friend.next('status', frame => frame.status === 'away');
			const back = await joinAs(readerId, session.code);

			release();

			expect((await pending).status).toBe(409);
			await until(() => closes().length === 1);
			expect(friend.frames.some(frame => frame.t === 'voice')).toBe(false);

			back.ws.close();
			friend.ws.close();
		});

		it('closes the track a failed start made, whichever part failed and whenever', async () => {
			const { friend, reader, readerId, session } = await room();

			// TURN fails after the track was made.
			failing = path => path.endsWith('/generate-ice-servers');
			expect((await voiceOn(readerId, session.id)).status).toBe(502);
			await until(() => closes().length === 1);

			// TURN fails first; the track is made after.
			const release = hold(tracksNew);
			const pending = voiceOn(readerId, session.id);

			await until(() => calls.filter(c => c.path.endsWith('/generate-ice-servers')).length === 2);
			release();
			expect((await pending).status).toBe(502);
			await until(() => closes().length === 2);

			// The track was made, but Cloudflare's answer is not one.
			failing = false;
			respond = path => (tracksNew(path) ? json({ tracks: [{ mid: '0' }] }) : undefined);
			expect((await voiceOn(readerId, session.id)).status).toBe(502);
			await until(() => closes().length === 3);
			expect(new Set(closes().map(c => c.path)).size).toBe(3);
			expect(friend.frames.some(frame => frame.t === 'voice')).toBe(false);

			reader.ws.close();
			friend.ws.close();
		});

		it('closes the track a failed listen made', async () => {
			const { friend, friendId, reader, readerId, session } = await room();

			await voiceOn(readerId, session.id);

			failing = path => path.endsWith('/generate-ice-servers');
			expect((await listen(friendId, session.id)).status).toBe(502);
			await until(() => closes().some(c => c.path === `/apps/app/sessions/cf-${sessions}/tracks/close`));

			// Made, but voice went off before it could be registered.
			failing = false;
			const release = hold(tracksNew);
			const pending = listen(friendId, session.id);

			await until(() => calls.filter(c => tracksNew(c.path)).length === 3);
			const listener = `cf-${sessions}`;

			await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId });
			release();

			expect((await pending).status).toBe(409);
			await until(() => closes().some(c => c.path === `/apps/app/sessions/${listener}/tracks/close`));

			reader.ws.close();
			friend.ws.close();
		});

		it('retries closing a track, and logs once it gives up — without a token', async () => {
			const { friend, reader, readerId, session } = await room();
			const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

			await voiceOn(readerId, session.id);

			// Started again: the first track's close fails once, then succeeds — nothing logged.
			let failures = 1;

			failing = path => path.endsWith('/tracks/close') && failures-- > 0;
			await voiceOn(readerId, session.id);
			await until(() => closes().length === 2);
			await new Promise(resolve => setTimeout(resolve, 100));
			expect(logged).not.toHaveBeenCalled();

			// Every attempt fails: three, then one log line.
			failing = path => path.endsWith('/tracks/close');
			await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId });
			await until(() => logged.mock.calls.length === 1);
			expect(closes()).toHaveLength(5);
			expect(logged.mock.calls[0]![0]).toMatchObject({
				cloudflareSessionId: `cf-${sessions}`,
				message: 'Could not close a voice track at Cloudflare',
				mid: '0'
			});
			expect(JSON.stringify(logged.mock.calls)).not.toMatch(/token|Bearer/);

			reader.ws.close();
			friend.ws.close();
		});

		it('takes a session Cloudflare already let go (410) as closed — no retries, nothing logged', async () => {
			const { friend, reader, readerId, session } = await room();
			const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

			await voiceOn(readerId, session.id);
			// The reader's phone hung up first, so Cloudflare has already ended the session.
			respond = path => (path.endsWith('/tracks/close') ? json({ errorCode: 'session_error' }, 410) : undefined);
			await call('DELETE', `/api/live/${session.id}/voice`, { user: readerId });
			await until(() => closes().length === 1);
			await new Promise(resolve => setTimeout(resolve, 100));

			expect(closes()).toHaveLength(1);
			expect(logged).not.toHaveBeenCalled();

			reader.ws.close();
			friend.ws.close();
		});

		// Last in this block: it ends every room in the process, as a shutdown does.
		it('closes every reader’s track on shutdown, without waiting long on Cloudflare', async () => {
			const first = await room();
			const second = await room();

			await voiceOn(first.readerId, first.session.id);
			const fast = `cf-${sessions}`;
			await voiceOn(second.readerId, second.session.id);
			const slow = `cf-${sessions}`;
			const release = hold(path => path === `/apps/app/sessions/${slow}/tracks/close`);
			const started = Date.now();

			await stopAllRooms();

			expect(Date.now() - started).toBeLessThan(1000);
			expect(closes().map(c => c.path)).toEqual(
				expect.arrayContaining([
					`/apps/app/sessions/${fast}/tracks/close`,
					`/apps/app/sessions/${slow}/tracks/close`
				])
			);

			release();
			[first.reader, first.friend, second.reader, second.friend].forEach(socket => socket.ws.close());
		});
	});
});

/*
 * **A full session: 500 followers, all joining at once, then a reader moving four times a second.**
 * Everything runs in this one process — server, reader and every follower — so the numbers are a
 * floor for the server's own work, not a promise about phones on mobile networks. What it does
 * prove is the fan-out: nobody is dropped, nobody misses the reader's place, and a place reaches
 * all 500 quickly enough to read as live.
 */
describe('live reading at full size', () => {
	const FOLLOWERS = 500;
	const MOVES = 40;
	const MOVE_EVERY_MS = 250;

	/** A follower that keeps only what the test measures — 500 full mailboxes would be the test's own load. */
	const lean = async (user: string, code: string, sentAt: Map<number, number>) => {
		// Each follower from an address of its own, as 500 phones would be — not one address's flood.
		const ws = new WebSocket(socketUrl, { headers: { 'x-forwarded-for': `10.0.${user.length}.${user}` } });
		const state = { closedWith: 0, latencies: [] as number[], lastF: -1, peopleCount: 0, joined: false };
		let onJoined = () => {};
		const joined = new Promise<void>(resolve => (onJoined = resolve));

		ws.on('message', data => {
			const frame = JSON.parse(data.toString()) as Frame;

			if (frame.t === 'ready') {
				ws.send(JSON.stringify({ t: 'join', code }));
			} else if (frame.t === 'snapshot') {
				state.joined = true;
				state.peopleCount = (frame.people as unknown[]).length;
				onJoined();
			} else if (frame.t === 'people') {
				state.peopleCount = (frame.people as unknown[]).length;
			} else if (frame.t === 'pos') {
				const f = (frame.pos as { f: number }).f;
				const sent = sentAt.get(f);

				// Only the measured moves — the reader's moves while people join are not timed.
				if (sent !== undefined) {
					state.latencies.push(performance.now() - sent);
					state.lastF = f;
				}
			}
		});
		ws.on('close', code => (state.closedWith = code));
		await new Promise(resolve => ws.once('open', resolve));
		ws.send(JSON.stringify({ t: 'auth', token: user }));

		return { joined, state, ws };
	};

	it('carries every move to 500 followers, without lag or a dropped socket', { timeout: 120_000 }, async () => {
		const { code } = await start('reader');
		const reader = await joinAs('reader', code);
		const sentAt = new Map<number, number>();

		// The reader keeps reading while people arrive, as they would — and the idle window, shortened
		// for these tests, would otherwise end the session before everyone is in.
		let warmup = 0;
		const keepReading = setInterval(() => {
			warmup += 1;
			reader.send({ t: 'pos', seq: warmup, pos: cevsen(1, 0.5 + warmup / 1000) });
		}, 1000);
		const joinStarted = performance.now();
		const followers = await Promise.all(
			Array.from({ length: FOLLOWERS }, (_, index) => lean(`follower-${index}`, code, sentAt))
		);

		await Promise.race([
			Promise.all(followers.map(follower => follower.joined)),
			new Promise(resolve => setTimeout(resolve, 30_000))
		]);
		const joinMs = performance.now() - joinStarted;
		const closes = new Map<number, number>();

		followers.forEach(follower =>
			closes.set(follower.state.closedWith, (closes.get(follower.state.closedWith) ?? 0) + 1)
		);
		console.info(
			`[load] joined ${followers.filter(follower => follower.state.joined).length}/${FOLLOWERS} in ${Math.round(
				joinMs
			)}ms · closes ${JSON.stringify([...closes])}`
		);

		// Everyone's list settles on the reader and all 500.
		const settleStarted = performance.now();

		while (followers.some(follower => follower.state.peopleCount !== FOLLOWERS + 1)) {
			if (performance.now() - settleStarted > 10_000) {
				break;
			}

			await new Promise(resolve => setTimeout(resolve, 50));
		}

		const settleMs = performance.now() - settleStarted;

		clearInterval(keepReading);

		for (let move = 1; move <= MOVES; move++) {
			const f = move / 1000;

			sentAt.set(f, performance.now());
			reader.send({ t: 'pos', seq: warmup + move, pos: cevsen(1 + (move % 100), f) });
			await new Promise(resolve => setTimeout(resolve, MOVE_EVERY_MS));
		}

		// The last move has had a full beat to arrive.
		await new Promise(resolve => setTimeout(resolve, 500));

		const latencies = followers.flatMap(follower => follower.state.latencies).sort((a, b) => a - b);
		const at = (share: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * share))]!;

		console.info(
			`[load] join ${Math.round(joinMs)}ms · people settled ${Math.round(settleMs)}ms · ` +
				`${latencies.length}/${FOLLOWERS * MOVES} moves · p50 ${at(0.5).toFixed(1)}ms · ` +
				`p95 ${at(0.95).toFixed(1)}ms · max ${latencies.at(-1)!.toFixed(1)}ms`
		);

		expect(followers.filter(follower => follower.state.closedWith !== 0)).toHaveLength(0);
		expect(followers.filter(follower => follower.state.peopleCount !== FOLLOWERS + 1)).toHaveLength(0);
		expect(latencies).toHaveLength(FOLLOWERS * MOVES);
		expect(followers.every(follower => follower.state.lastF === MOVES / 1000)).toBe(true);
		expect(at(0.95)).toBeLessThan(100);

		// Half of them leave together; everyone still here sees the list settle on who is left.
		const [leaving, staying] = [followers.slice(0, FOLLOWERS / 2), followers.slice(FOLLOWERS / 2)];

		leaving.forEach(follower => follower.ws.close());

		const leaveStarted = performance.now();

		while (staying.some(follower => follower.state.peopleCount !== FOLLOWERS / 2 + 1)) {
			expect(performance.now() - leaveStarted).toBeLessThan(5_000);
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		expect(staying.filter(follower => follower.state.closedWith !== 0)).toHaveLength(0);

		reader.ws.close();
		staying.forEach(follower => follower.ws.close());
	});
});
