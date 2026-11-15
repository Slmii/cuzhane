import { verifyToken } from '@clerk/express';
import { env } from '@config/env';
import {
	AUTH_LIFETIME_MS,
	AUTH_TIMEOUT_MS,
	CLOSE,
	ClientFrameSchema,
	FRAMES_PER_SECOND,
	JOINS_PER_MINUTE,
	LIVE_SOCKET_PATH,
	MAX_DROPPED_FRAMES,
	MAX_FRAME_BYTES,
	MAX_PENDING_SOCKETS,
	MAX_PENDING_SOCKETS_PER_ADDRESS,
	MAX_SOCKETS_PER_USER,
	PING_INTERVAL_MS
} from '@schemas/live.schema';
import {
	joinRoom,
	leaveRoom,
	publishMark,
	publishPosition,
	publishVoice,
	send,
	stopAllRooms,
	type LiveClient
} from '@services/liveHub.service';
import { findLiveSessionByCode } from '@services/liveSession.service';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

/**
 * The live-reading socket, attached to the API's own HTTP server.
 *
 * **Everything Express does for a request, this does for itself.** An upgrade never reaches the
 * middleware stack, so there is no `clerkMiddleware`, no `validateData`, no body limit and no
 * rate limiter here — the checks below are the only ones:
 *
 * - **Sign-in is the first frame, never the URL.** Caddy logs request URIs, and a token in a query
 *   string would sit in those logs. Until an `auth` frame verifies (within `AUTH_TIMEOUT_MS`) the
 *   socket is told nothing about any session. Clerk tokens live about a minute, so a signed-in
 *   socket stays signed in for `AUTH_LIFETIME_MS` and the app refreshes it with `reauth`.
 * - Frames are capped at `MAX_FRAME_BYTES` by `ws` itself, parsed with Zod, and metered per socket
 *   (a token bucket); a socket that keeps flooding is closed. One person may hold
 *   `MAX_SOCKETS_PER_USER` sockets at once; before sign-in, sockets are capped in all and per address
 *   (`MAX_PENDING_SOCKETS*`), since no per-user limit can apply yet.
 * - Joining by code is metered per person (`JOINS_PER_MINUTE`), across reconnects — the socket's
 *   share of the wall the REST lookup has against guessing codes.
 * - Pings every `PING_INTERVAL_MS` find sockets whose phone vanished without closing them.
 */

/**
 * Closes a person's live sockets wherever they are — account deletion, so a deleted reader leaves
 * the people list at once rather than when their sign-in runs out. One closer per attached server.
 */
const userClosers = new Set<(userId: string) => void>();

export const closeLiveSocketsOf = (userId: string) => {
	for (const closeUser of userClosers) {
		closeUser(normalizeUserId(userId));
	}
};

/** The client's address as Caddy saw it — its first `X-Forwarded-For` entry — or the socket's own. */
const addressOf = (request: IncomingMessage) => {
	const forwarded = request.headers['x-forwarded-for'];
	const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();

	return first || request.socket.remoteAddress || 'unknown';
};

type SocketState = LiveClient & {
	/** Null until the first `auth` frame verifies. */
	signedInAs: string | null;
	authUntil: number;
	authTimer: NodeJS.Timeout | null;
	tokens: number;
	refilledAt: number;
	dropped: number;
	isAlive: boolean;
	/** Counted against the pending caps until it signs in or closes. */
	address: string;
	isPending: boolean;
};

const tokenUser = async (token: string): Promise<string | null> => {
	try {
		const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });

		return typeof payload.sub === 'string' && payload.sub.length > 0 ? normalizeUserId(payload.sub) : null;
	} catch {
		return null;
	}
};

/** True if this frame may be handled; false once the socket has used up its allowance. */
const takeToken = (state: SocketState) => {
	const now = Date.now();

	state.tokens = Math.min(FRAMES_PER_SECOND, state.tokens + ((now - state.refilledAt) / 1000) * FRAMES_PER_SECOND);
	state.refilledAt = now;

	if (state.tokens >= 1) {
		state.tokens -= 1;
		return true;
	}

	return false;
};

export const attachLiveSockets = (server: Server) => {
	const wss = new WebSocketServer({ maxPayload: MAX_FRAME_BYTES, noServer: true });
	const states = new Map<WebSocket, SocketState>();
	const socketsByUser = new Map<string, Set<WebSocket>>();
	const pendingByAddress = new Map<string, number>();
	let pendingCount = 0;
	/** Code lookups per person in the current minute — kept across sockets, so reconnecting resets nothing. */
	const joinsByUser = new Map<string, { count: number; windowStart: number }>();

	const takeJoin = (userId: string) => {
		const now = Date.now();
		const current = joinsByUser.get(userId);

		if (!current || now - current.windowStart >= 60_000) {
			joinsByUser.set(userId, { count: 1, windowStart: now });
			return true;
		}

		current.count += 1;

		return current.count <= JOINS_PER_MINUTE;
	};

	const settlePending = (state: SocketState) => {
		if (!state.isPending) {
			return;
		}

		state.isPending = false;
		pendingCount -= 1;

		const left = (pendingByAddress.get(state.address) ?? 1) - 1;

		if (left <= 0) {
			pendingByAddress.delete(state.address);
		} else {
			pendingByAddress.set(state.address, left);
		}
	};

	const closeUser = (userId: string) => {
		for (const ws of socketsByUser.get(userId) ?? []) {
			ws.close(CLOSE.unauthorized, 'account deleted');
		}
	};

	userClosers.add(closeUser);

	const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
		const path = new URL(request.url ?? '/', 'http://localhost').pathname;

		// Not ours: nothing else in the API speaks WebSocket, so any other upgrade is refused.
		if (path !== LIVE_SOCKET_PATH) {
			socket.destroy();
			return;
		}

		// Too many sockets nobody has signed in on yet — in all, or from this address.
		const address = addressOf(request);

		if (
			pendingCount >= MAX_PENDING_SOCKETS ||
			(pendingByAddress.get(address) ?? 0) >= MAX_PENDING_SOCKETS_PER_ADDRESS
		) {
			socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
			socket.destroy();
			return;
		}

		wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
	};

	server.on('upgrade', onUpgrade);

	const drop = (state: SocketState) => {
		state.dropped += 1;

		if (state.dropped > MAX_DROPPED_FRAMES) {
			state.ws.close(CLOSE.tooMany, 'too many frames');
		}
	};

	/** A socket may close while a sign-in or join is still awaiting; nothing may register it after. */
	const isOpen = (state: SocketState) => state.ws.readyState === state.ws.OPEN;

	const signIn = async (state: SocketState, token: string, isRefresh: boolean) => {
		const userId = await tokenUser(token);

		if (!isOpen(state)) {
			return;
		}

		// A refresh must be the same person: a socket never changes hands.
		if (userId === null || (isRefresh && userId !== state.signedInAs)) {
			state.ws.close(CLOSE.unauthorized, 'unauthorized');
			return;
		}

		state.authUntil = Date.now() + AUTH_LIFETIME_MS;

		if (isRefresh) {
			return;
		}

		const sockets = socketsByUser.get(userId) ?? new Set<WebSocket>();

		if (sockets.size >= MAX_SOCKETS_PER_USER) {
			state.ws.close(CLOSE.tooMany, 'too many sockets');
			return;
		}

		sockets.add(state.ws);
		socketsByUser.set(userId, sockets);

		if (state.authTimer) {
			clearTimeout(state.authTimer);
			state.authTimer = null;
		}

		state.signedInAs = userId;
		state.userId = userId;
		settlePending(state);
		send(state, { t: 'ready' });
	};

	const onMessage = async (state: SocketState, data: RawData) => {
		if (!isOpen(state)) {
			return;
		}

		let frame;

		try {
			frame = ClientFrameSchema.safeParse(JSON.parse(data.toString()));
		} catch {
			frame = null;
		}

		if (!frame?.success) {
			send(state, { code: 'bad-frame', t: 'error' });
			drop(state);
			return;
		}

		const message = frame.data;

		if (message.t === 'auth' || message.t === 'reauth') {
			// `auth` twice is a client bug; treat it as a refresh so it cannot switch users.
			await signIn(state, message.token, message.t === 'reauth' || state.signedInAs !== null);
			return;
		}

		if (state.signedInAs === null) {
			state.ws.close(CLOSE.unauthorized, 'unauthorized');
			return;
		}

		if (message.t === 'join') {
			leaveRoom(state);

			// Final for the app (4429): it stops trying rather than guessing on.
			if (!takeJoin(state.signedInAs)) {
				send(state, { code: 'too-many', t: 'error' });
				state.ws.close(CLOSE.tooMany, 'too many joins');
				return;
			}

			const session = await findLiveSessionByCode(message.code);

			if (!isOpen(state)) {
				return;
			}

			// `joinRoom` refuses a session this process has ended since the row was read.
			if (!session || !(await joinRoom(state, session))) {
				send(state, { code: 'not-found', t: 'error' });
				state.ws.close(CLOSE.notFound, 'not found');
			}

			return;
		}

		if (message.t === 'mark') {
			publishMark(state, message.seq, message.mark, message.shown);
			return;
		}

		if (message.t === 'voice') {
			publishVoice(state, message.seq, message.state);
			return;
		}

		publishPosition(state, message.seq, message.pos);
	};

	wss.on('connection', (ws, request: IncomingMessage) => {
		const address = addressOf(request);
		const state: SocketState = {
			address,
			authTimer: null,
			authUntil: 0,
			dropped: 0,
			isAlive: true,
			isPending: true,
			lastSeq: -1,
			refilledAt: Date.now(),
			sessionId: null,
			signedInAs: null,
			tokens: FRAMES_PER_SECOND,
			userId: '',
			ws
		};

		states.set(ws, state);
		pendingCount += 1;
		pendingByAddress.set(address, (pendingByAddress.get(address) ?? 0) + 1);
		state.authTimer = setTimeout(() => {
			if (state.signedInAs === null) {
				ws.close(CLOSE.unauthorized, 'auth timeout');
			}
		}, AUTH_TIMEOUT_MS);
		state.authTimer.unref();

		ws.on('pong', () => {
			state.isAlive = true;
		});

		/*
		 * **Load-bearing.** `ws` reports a bad frame — too large, invalid UTF-8, a broken close — as
		 * an `error` on the socket before closing it, and an `error` with no listener is thrown by
		 * the event emitter: one oversized message from anyone would take the whole API down. The
		 * socket closes itself (1009, 1007…); there is nothing else to do.
		 */
		ws.on('error', () => undefined);

		// Frames are handled in order: a `join` resolving after the next `pos` would drop it.
		let queue = Promise.resolve();

		ws.on('message', data => {
			/*
			 * **Metered before it is queued.** Metering inside the queue let a flood pile up
			 * behind a slow sign-in or join — every frame held in memory before any was counted.
			 */
			if (!takeToken(state)) {
				drop(state);
				return;
			}

			queue = queue.then(() => onMessage(state, data)).catch(() => ws.close(CLOSE.restart, 'error'));
		});

		ws.on('close', () => {
			if (state.authTimer) {
				clearTimeout(state.authTimer);
			}

			leaveRoom(state);
			states.delete(ws);
			settlePending(state);

			if (state.signedInAs) {
				const sockets = socketsByUser.get(state.signedInAs);

				sockets?.delete(ws);

				if (sockets?.size === 0) {
					socketsByUser.delete(state.signedInAs);
				}
			}
		});
	});

	const sweep = setInterval(() => {
		const now = Date.now();

		// A minute's join counts are spent once their minute is over.
		for (const [userId, joins] of joinsByUser) {
			if (now - joins.windowStart >= 60_000) {
				joinsByUser.delete(userId);
			}
		}

		for (const state of states.values()) {
			if (!state.isAlive) {
				state.ws.terminate();
				continue;
			}

			if (state.signedInAs !== null && state.authUntil < now) {
				state.ws.close(CLOSE.unauthorized, 'auth expired');
				continue;
			}

			state.isAlive = false;
			state.ws.ping();
		}
	}, PING_INTERVAL_MS);
	sweep.unref();

	return {
		/**
		 * Shutdown: every client is told to reconnect (1012) rather than left to time out. Resolves
		 * once the readers' voice tracks are closed at Cloudflare, or that has taken too long.
		 */
		close: async () => {
			clearInterval(sweep);
			server.off('upgrade', onUpgrade);
			userClosers.delete(closeUser);

			const rooms = stopAllRooms();

			for (const ws of states.keys()) {
				ws.close(CLOSE.restart, 'restart');
			}

			wss.close();
			await rooms;
		}
	};
};
