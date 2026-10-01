import prisma from '@db/prisma';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

	return { ...actual, AUTH_TIMEOUT_MS: 150, IDLE_AFTER_MS: 2000, LEADER_GRACE_MS: 700 };
});

const { createApp } = await import('@app');
const { attachLiveSockets } = await import('@services/liveSocket.service');
const { deleteAccountForUser } = await import('@services/account.service');

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

	it('closes a socket that sends an oversized frame', async () => {
		const socket = await connect();

		socket.ws.send('x'.repeat(4096));

		expect(await socket.closed).toBe(1009);
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
		const ws = new WebSocket(socketUrl);
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
