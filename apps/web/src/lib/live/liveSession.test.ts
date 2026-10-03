import type { LivePosition, LiveServerFrame } from '@/lib/types/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real API and socket pull in React Native; the session is tested against fakes of both.
vi.mock('@/api/live.api', () => ({ endLiveSession: vi.fn(), startLiveSession: vi.fn() }));
vi.mock('@/lib/utils/liveConnection', () => ({ openLiveConnection: vi.fn() }));

const { createLiveSession, LINE_SHOWN_MS } = await import('@/lib/live/liveSession');

type Handlers = Parameters<Parameters<typeof createLiveSession>[0]['open']>[1];

/** A socket that records what it sends and lets the test play the server. */
const fakeConnection = () => {
	const sent: { t: string; [key: string]: unknown }[] = [];
	let handlers: Handlers | null = null;

	return {
		close: vi.fn(),
		handlersOf: () => handlers as Handlers,
		open: (_code: string, given: Handlers) => {
			handlers = given;

			return {
				close: vi.fn(),
				sendMark: (mark: unknown, shown: boolean) => sent.push({ mark, shown, t: 'mark' }),
				sendPosition: (pos: LivePosition) => sent.push({ pos, t: 'pos' })
			};
		},
		sent
	};
};

const cevsen = (bab: number, f = 0): LivePosition => ({ bab, f, k: 'CEVSEN' });

const snapshot = (overrides: Partial<Extract<LiveServerFrame, { t: 'snapshot' }>> = {}): LiveServerFrame => ({
	mark: null,
	markShown: false,
	people: [
		{ isLeader: true, isListening: false, isYou: false, name: 'Reader' },
		{ isLeader: false, isListening: false, isYou: true, name: 'Me' }
	],
	pos: null,
	role: 'follower',
	seq: 0,
	session: { code: 'ABCD2345', id: 'session-1', kind: 'CEVSEN', startedAt: '2026-10-01T10:00:00.000Z' },
	status: 'live',
	t: 'snapshot',
	voice: 'off',
	...overrides
});

const setup = () => {
	const socket = fakeConnection();
	const end = vi.fn(async () => ({ success: true }));
	const start = vi.fn(async () => ({ code: 'LEAD2345', kind: 'CEVSEN' as const }));
	const session = createLiveSession({ end, now: () => Date.now(), open: socket.open as never, start });

	return { end, session, socket, start };
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('live session', () => {
	it('keeps the reading and its place when no reader screen is open', () => {
		const { session, socket } = setup();

		session.join('ABCD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(14, 0.3) }));
		socket.handlersOf().onFrame({ pos: cevsen(15, 0.1), seq: 1, t: 'pos' });

		expect(session.getSnapshot()).toMatchObject({ code: 'ABCD2345', readerPlace: { bab: 15 }, role: 'follower' });
		expect(session.placeFor('CEVSEN')).toEqual(cevsen(15, 0.1));
		// Another kind's reader gets nothing to start from.
		expect(session.placeFor('QURAN')).toBeNull();
	});

	it('re-renders for words, never for a scroll on the same bab', () => {
		const { session, socket } = setup();
		const listener = vi.fn();

		session.join('ABCD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(14) }));
		session.subscribe(listener);

		socket.handlersOf().onFrame({ pos: cevsen(14, 0.4), seq: 1, t: 'pos' });
		socket.handlersOf().onFrame({ pos: cevsen(14, 0.6), seq: 2, t: 'pos' });
		expect(listener).not.toHaveBeenCalled();

		socket.handlersOf().onFrame({ pos: cevsen(15), seq: 3, t: 'pos' });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('moves only the screen attached last, and brings a returning follower to the reader', () => {
		const { session, socket } = setup();
		const first = vi.fn();
		const second = vi.fn();

		session.join('ABCD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(14, 0.3) }));

		const firstHandle = session.attach({ getPosition: () => null, kind: 'CEVSEN', onPosition: first });

		// Arriving: the reader's place at once.
		expect(first).toHaveBeenCalledWith(cevsen(14, 0.3));

		const secondHandle = session.attach({ getPosition: () => null, kind: 'CEVSEN', onPosition: second });

		socket.handlersOf().onFrame({ pos: cevsen(16), seq: 1, t: 'pos' });
		expect(second).toHaveBeenLastCalledWith(cevsen(16));
		expect(first).not.toHaveBeenCalledWith(cevsen(16));

		// The second lets go: the first is in charge again.
		secondHandle.release();
		socket.handlersOf().onFrame({ pos: cevsen(17), seq: 2, t: 'pos' });
		expect(first).toHaveBeenLastCalledWith(cevsen(17));
		firstHandle.release();
	});

	it('lets a follower sent somewhere of their own arrive let go, and "Takip et" bring them back', () => {
		const { session, socket } = setup();
		const onPosition = vi.fn();

		session.join('ABCD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(14) }));

		const handle = session.attach({ getPosition: () => null, isExplicitPlace: true, kind: 'CEVSEN', onPosition });

		expect(session.getSnapshot()?.isDetached).toBe(true);
		socket.handlersOf().onFrame({ pos: cevsen(20), seq: 1, t: 'pos' });
		expect(onPosition).not.toHaveBeenCalled();

		handle.follow();
		expect(session.getSnapshot()?.isDetached).toBe(false);
		expect(onPosition).toHaveBeenCalledWith(cevsen(20));
	});

	it('publishes only from the attached reader, four times a second at most, the last always', () => {
		const { session, socket } = setup();

		session.join('LEAD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ role: 'leader' }));

		const hidden = session.attach({ getPosition: () => null, kind: 'CEVSEN', onPosition: vi.fn() });
		const shown = session.attach({ getPosition: () => null, kind: 'CEVSEN', onPosition: vi.fn() });

		hidden.publish(cevsen(99));
		expect(socket.sent).toEqual([]);

		shown.publish(cevsen(1, 0.1));
		shown.publish(cevsen(1, 0.2));
		shown.publish(cevsen(1, 0.3));
		expect(socket.sent).toEqual([{ pos: cevsen(1, 0.1), t: 'pos' }]);

		vi.advanceTimersByTime(250);
		expect(socket.sent).toEqual([
			{ pos: cevsen(1, 0.1), t: 'pos' },
			{ pos: cevsen(1, 0.3), t: 'pos' }
		]);
		expect(session.placeFor('CEVSEN')).toEqual(cevsen(1, 0.3));
		// The reader's own place is the reading's, for the return strip to say.
		expect(session.getSnapshot()?.readerPlace).toEqual({ bab: 1, k: 'CEVSEN' });
	});

	it('sends a reader’s place on (re)joining only when the server’s differs', () => {
		const { session, socket } = setup();

		session.join('LEAD2345', 'CEVSEN');

		// A session just started: the screen's own place goes out.
		session.attach({ getPosition: () => cevsen(3, 0.5), kind: 'CEVSEN', onPosition: vi.fn() });
		socket.handlersOf().onFrame(snapshot({ role: 'leader' }));
		expect(socket.sent).toEqual([{ pos: cevsen(3, 0.5), t: 'pos' }]);

		// Back from the background with the server up to date: nothing, so the idle rule is not fooled.
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(3, 0.5), role: 'leader' }));
		expect(socket.sent).toHaveLength(1);

		// A server that lost the room: the reader's place again.
		socket.handlersOf().onFrame(snapshot({ pos: null, role: 'leader' }));
		expect(socket.sent).toHaveLength(2);
	});

	it('takes the reader’s line away three seconds after the last tap, wherever they are', () => {
		const { session, socket } = setup();
		const mark = { bab: 1, k: 'CEVSEN' as const, n: 4 };

		session.join('LEAD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ role: 'leader' }));

		const handle = session.attach({ getPosition: () => null, kind: 'CEVSEN', onPosition: vi.fn() });

		handle.publishMark(mark, true, { isTap: true });
		// The reader leaves the screen; the rule still holds.
		handle.release();
		vi.advanceTimersByTime(LINE_SHOWN_MS);

		expect(session.markStore.get().mark).toBeNull();
		expect(socket.sent.at(-1)).toEqual({ mark: null, shown: false, t: 'mark' });
	});

	it('mirrors the server: a position on another bab takes the line away', () => {
		const { session, socket } = setup();

		session.join('ABCD2345', 'CEVSEN');
		socket
			.handlersOf()
			.onFrame(snapshot({ mark: { bab: 14, k: 'CEVSEN', n: 2 }, markShown: true, pos: cevsen(14) }));
		expect(session.markStore.get().mark).not.toBeNull();

		socket.handlersOf().onFrame({ pos: cevsen(15), seq: 1, t: 'pos' });
		expect(session.markStore.get().mark).toBeNull();
	});

	it('joins the same code once, and ends the reader’s own session to join another', async () => {
		const { end, session, socket } = setup();

		session.join('LEAD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ role: 'leader' }));
		session.join('LEAD2345', 'CEVSEN');
		expect(end).not.toHaveBeenCalled();

		session.join('OTHR2345', 'QURAN');
		await vi.runAllTimersAsync();

		expect(end).toHaveBeenCalledWith('session-1');
		expect(session.getSnapshot()).toMatchObject({ code: 'OTHR2345', kind: 'QURAN', role: null });
	});

	it('starts as the reader and ends for everyone', async () => {
		const { end, session, socket, start } = setup();

		await session.start('CEVSEN');
		expect(start).toHaveBeenCalledWith('CEVSEN');
		expect(session.getSnapshot()?.code).toBe('LEAD2345');

		socket.handlersOf().onFrame(snapshot({ role: 'leader' }));
		await session.end();

		expect(end).toHaveBeenCalledWith('session-1');
		expect(session.getSnapshot()).toBeNull();
	});

	it('keeps an ended session to show, until it is put away; a reset forgets it all', () => {
		const { session, socket } = setup();

		session.join('ABCD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(14) }));
		socket.handlersOf().onFrame({ reason: 'leader-left', t: 'ended' });

		expect(session.getSnapshot()?.gone).toBe('leader-left');
		expect(session.placeFor('CEVSEN')).toBeNull();

		session.leave();
		expect(session.getSnapshot()).toBeNull();

		session.join('ABCD2345', 'CEVSEN');
		session.reset();
		expect(session.getSnapshot()).toBeNull();
	});

	it('ignores a frame from a socket it has already let go', () => {
		const { session, socket } = setup();

		session.join('ABCD2345', 'CEVSEN');

		const stale = socket.handlersOf();

		session.join('OTHR2345', 'CEVSEN');
		stale.onFrame(snapshot({ pos: cevsen(50) }));

		expect(session.getSnapshot()).toMatchObject({ code: 'OTHR2345', role: null });
	});

	it('drops a start the person stopped wanting while the server answered', async () => {
		const { session, start } = setup();
		let answer: (value: { code: string; kind: 'CEVSEN' }) => void = () => undefined;

		start.mockImplementationOnce(() => new Promise(resolve => (answer = resolve)));

		const starting = session.start('CEVSEN');

		await vi.advanceTimersByTimeAsync(0);
		// Signed out meanwhile.
		session.reset();
		answer({ code: 'LATE2345', kind: 'CEVSEN' });
		await starting;

		expect(session.getSnapshot()).toBeNull();
	});

	it('brings a returning reader screen to the reading before it may send its old place', () => {
		const { session, socket } = setup();
		const onPosition = vi.fn();

		session.join('LEAD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(14, 0.5), role: 'leader' }));

		const first = session.attach({ getPosition: () => cevsen(14, 0.5), kind: 'CEVSEN', onPosition: vi.fn() });

		first.publish(cevsen(20, 0.2));
		first.release();
		socket.sent.length = 0;

		// An older screen of theirs, still on bab 3, comes back into focus.
		const older = session.attach({ getPosition: () => cevsen(3), kind: 'CEVSEN', onPosition });

		expect(onPosition).toHaveBeenCalledWith(cevsen(20, 0.2));
		older.publish(cevsen(3));
		vi.advanceTimersByTime(300);
		expect(socket.sent).toEqual([]);

		// The right bab but its old place on it is not there yet either.
		older.publish(cevsen(20, 0.9));
		vi.advanceTimersByTime(300);
		expect(socket.sent).toEqual([]);

		// Once it is there, it reads on as usual.
		older.publish(cevsen(20, 0.21));
		vi.advanceTimersByTime(300);
		older.publish(cevsen(20, 0.3));
		vi.advanceTimersByTime(300);
		expect(socket.sent).toEqual([
			{ pos: cevsen(20, 0.21), t: 'pos' },
			{ pos: cevsen(20, 0.3), t: 'pos' }
		]);
	});

	it('carries the reader’s voice, and passes on every announcement of it — the same one again too', () => {
		const { session, socket } = setup();
		const heard = vi.fn();

		session.onVoice(heard);
		session.join('ABCD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ voice: 'on' }));
		expect(session.getSnapshot()?.voice).toBe('on');

		socket.handlersOf().onFrame({ t: 'voice', voice: 'on' });
		socket.handlersOf().onFrame({ t: 'voice', voice: 'paused' });
		expect(session.getSnapshot()?.voice).toBe('paused');
		expect(heard.mock.calls).toEqual([
			['on', true],
			['on', false],
			['paused', false]
		]);

		// Over with the session.
		socket.handlersOf().onFrame({ reason: 'ended', t: 'ended' });
		expect(session.getSnapshot()?.voice).toBe('off');
	});

	it('lets a follower’s line go on its own when the reader’s clear never comes', () => {
		const { session, socket } = setup();

		session.join('ABCD2345', 'CEVSEN');
		socket.handlersOf().onFrame(snapshot({ pos: cevsen(14) }));
		socket.handlersOf().onFrame({ mark: { bab: 14, k: 'CEVSEN', n: 3 }, seq: 1, shown: true, t: 'mark' });
		expect(session.markStore.get().mark).not.toBeNull();

		vi.advanceTimersByTime(LINE_SHOWN_MS + 1000);
		expect(session.markStore.get().mark).toBeNull();
	});
});
