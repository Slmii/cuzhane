import { resolveAuthToken } from '@/api/wrapper.api';
import { API_BASE_URL } from '@/lib/constants';
import type { LiveMark, LivePosition, LiveServerFrame } from '@/lib/types/domain';
import { AppState } from 'react-native';

/**
 * One live-reading socket: signs in, joins a session by its code, keeps itself signed in and
 * connected, and hands every frame to `onFrame`.
 *
 * - **The token goes in the first frame, never the URL** — the server's proxy logs URLs. Clerk
 *   tokens are short-lived, so a fresh one is sent every `REAUTH_MS`.
 * - **It reconnects on its own**, with growing, jittered waits: a deploy restarts the API and
 *   drops every socket (1012), a phone changes networks. The session's code survives both.
 * - **It lets go in the background** (only there — see the listener). iOS suspends the app anyway;
 *   a socket left open would be killed without a close. It reconnects when the app is active
 *   again, and the server hands the current place straight back.
 * - **Some closes are final**: the session ended (4410) or never existed (4404) — reconnecting
 *   cannot help, so `onGone` is called instead.
 */

/** The server's close codes — see `apps/server/src/schemas/live.schema.ts`. */
const CLOSE_NOT_FOUND = 4404;
const CLOSE_ENDED = 4410;
const CLOSE_TOO_MANY = 4429;

const REAUTH_MS = 4 * 60_000;
const BACKOFF_FIRST_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

export type LiveConnectionState = 'connecting' | 'open' | 'closed';

type Handlers = {
	onFrame: (frame: LiveServerFrame) => void;
	onState: (state: LiveConnectionState) => void;
	/** The session is not there to reconnect to — it ended, or the code is wrong. */
	onGone: (reason: 'ended' | 'not-found' | 'refused') => void;
};

const socketUrl = () => `${API_BASE_URL.replace(/^http/, 'ws')}/api/live-socket`;

export const openLiveConnection = (code: string, handlers: Handlers) => {
	let ws: WebSocket | null = null;
	let isClosed = false;
	let attempt = 0;
	let seq = 0;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let reauthTimer: ReturnType<typeof setInterval> | null = null;

	const stopTimers = () => {
		if (retryTimer) {
			clearTimeout(retryTimer);
			retryTimer = null;
		}

		if (reauthTimer) {
			clearInterval(reauthTimer);
			reauthTimer = null;
		}
	};

	const sendOn = (socket: WebSocket | null, frame: object) => {
		if (socket?.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify(frame));
		}
	};

	const scheduleRetry = () => {
		if (isClosed || retryTimer || AppState.currentState !== 'active') {
			return;
		}

		const wait = Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** attempt) * (0.75 + Math.random() * 0.5);

		attempt += 1;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			connect();
		}, wait);
	};

	const connect = () => {
		if (isClosed || ws) {
			return;
		}

		handlers.onState('connecting');

		const socket = new WebSocket(socketUrl());

		ws = socket;

		socket.onopen = async () => {
			const token = await resolveAuthToken();

			if (!token) {
				socket.close();
				return;
			}

			// This socket's own sign-in, even if another has replaced it while the token was fetched.
			sendOn(socket, { t: 'auth', token });
		};

		socket.onmessage = event => {
			// A socket that has been replaced speaks for nobody.
			if (ws !== socket) {
				return;
			}

			let frame: LiveServerFrame;

			try {
				frame = JSON.parse(String(event.data)) as LiveServerFrame;
			} catch {
				return;
			}

			if (frame.t === 'ready') {
				sendOn(socket, { code, t: 'join' });
				reauthTimer = setInterval(async () => {
					const token = await resolveAuthToken();

					if (token) {
						sendOn(socket, { t: 'reauth', token });
					}
				}, REAUTH_MS);

				return;
			}

			if (frame.t === 'snapshot') {
				attempt = 0;
				handlers.onState('open');
			}

			handlers.onFrame(frame);
		};

		socket.onclose = event => {
			/*
			 * **Only the current socket's close counts.** One let go in the background (or replaced
			 * after a quick trip there) can finish closing after its successor has joined; acting on
			 * it stopped the successor's refresh timer, and its sign-in quietly ran out.
			 */
			if (ws !== socket) {
				return;
			}

			ws = null;
			stopTimers();

			if (isClosed) {
				return;
			}

			if (event.code === CLOSE_ENDED || event.code === CLOSE_NOT_FOUND || event.code === CLOSE_TOO_MANY) {
				isClosed = true;
				handlers.onState('closed');
				handlers.onGone(
					event.code === CLOSE_ENDED ? 'ended' : event.code === CLOSE_NOT_FOUND ? 'not-found' : 'refused'
				);

				return;
			}

			handlers.onState('connecting');
			scheduleRetry();
		};
	};

	const appState = AppState.addEventListener('change', next => {
		if (next === 'active') {
			attempt = 0;
			connect();
		} else if (next === 'background' && ws) {
			/*
			 * `background` only. iOS reports `inactive` for a moment whenever something covers
			 * the app — the share sheet the reader opens to send the code, Control Centre, an
			 * incoming call — and letting go then left the reader's own screen deaf to who joined.
			 * Let go rather than be killed: the server's grace window covers a short trip away.
			 */
			const socket = ws;

			ws = null;
			stopTimers();
			socket.close();
		}
	});

	connect();

	return {
		/** The reader's place. Numbered here so the server can drop a late frame. */
		sendPosition: (pos: LivePosition) => {
			seq += 1;
			sendOn(ws, { pos, seq, t: 'pos' });
		},
		/** The reader's line, numbered with the places so the two arrive in the order they were sent. */
		sendMark: (mark: LiveMark | null, shown: boolean) => {
			seq += 1;
			sendOn(ws, { mark, seq, shown, t: 'mark' });
		},
		close: () => {
			isClosed = true;
			stopTimers();
			appState.remove();
			ws?.close();
			ws = null;
		}
	};
};
