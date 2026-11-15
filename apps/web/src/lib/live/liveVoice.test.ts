import type { LiveServerFrame, LiveVoice } from '@/lib/types/domain';
import type { VoiceNative, VoicePeer, VoicePeerState } from '@/lib/live/voiceNative';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real API, socket and native pieces pull in React Native; the voice is tested against fakes.
vi.mock('@/api/live.api', () => ({
	answerLiveVoice: vi.fn(),
	endLiveSession: vi.fn(),
	listenLiveVoice: vi.fn(),
	startLiveSession: vi.fn(),
	startLiveVoice: vi.fn(),
	stopListeningLiveVoice: vi.fn(),
	stopLiveVoice: vi.fn()
}));
vi.mock('@/lib/utils/liveConnection', () => ({ openLiveConnection: vi.fn() }));
vi.mock('@/lib/live/voiceNative', () => ({ voiceNative: null }));

const { createLiveSession } = await import('@/lib/live/liveSession');
const {
	CONNECT_TIMEOUT_MS,
	createLiveVoice,
	LEVEL_INTERVAL_MS,
	levelBetween,
	loudnessOf,
	NOTICE_MS,
	SERVICE_GIVE_UP_MS,
	STOPPED_PANEL_MS
} = await import('@/lib/live/liveVoice');

type Handlers = Parameters<Parameters<typeof createLiveSession>[0]['open']>[1];

/** A socket that records what it sends and lets the test play the server. */
const fakeConnection = () => {
	const sent: { t: string; [key: string]: unknown }[] = [];
	const held: boolean[] = [];
	let handlers: Handlers | null = null;

	return {
		handlersOf: () => handlers as Handlers,
		held,
		open: (_code: string, given: Handlers) => {
			handlers = given;

			return {
				close: vi.fn(),
				hold: (isHolding: boolean) => held.push(isHolding),
				sendMark: vi.fn(),
				sendPosition: vi.fn(),
				sendVoice: (state: string) => sent.push({ state, t: 'voice' })
			};
		},
		sent
	};
};

/** A WebRTC connection the test moves through its states. */
const fakePeer = (iceServers: unknown[]) => {
	let listener: ((state: VoicePeerState) => void) | null = null;
	// The audio arriving: packets grow while it flows, and stop growing when it stops.
	// `hasEnergy`: the stats carry running energy (0.12 s of audio at `level` per sample) as well.
	const audio = { duration: 0, energy: 0, hasEnergy: false, isFlowing: true, level: 0.1, packets: 0 };
	const peer = {
		accept: vi.fn(async () => undefined),
		answer: vi.fn(async () => 'listener-answer'),
		close: vi.fn(),
		offer: vi.fn(async () => ({ mid: '0', sdp: 'reader-offer' })),
		onStateChange: (given: (state: VoicePeerState) => void) => {
			listener = given;
		},
		sample: vi.fn(async () => {
			if (audio.isFlowing) {
				audio.packets += 10;
			}

			if (!audio.hasEnergy) {
				return { duration: null, energy: null, level: audio.level, packets: audio.packets };
			}

			audio.energy += audio.level ** 2 * 0.12;
			audio.duration += 0.12;

			// `audioLevel` says otherwise, to show it is not the one read.
			return { duration: audio.duration, energy: audio.energy, level: 0.9, packets: audio.packets };
		})
	} satisfies VoicePeer;

	return { audio, iceServers, peer, setState: (state: VoicePeerState) => listener?.(state) };
};

const fakeNative = () => {
	const peers: ReturnType<typeof fakePeer>[] = [];
	const tracks: { stop: ReturnType<typeof vi.fn> }[] = [];
	let onCommand: ((command: 'play' | 'pause') => void) | null = null;
	let onInterruption: ((isInterrupted: boolean) => void) | null = null;
	let onHeadphonesLost: (() => void) | null = null;
	let onVolumeChange: ((volume: number) => void) | null = null;
	const api = {
		createPeer: vi.fn((iceServers: unknown[]) => {
			const created = fakePeer(iceServers);

			peers.push(created);

			return created.peer;
		}),
		getOutputVolume: vi.fn(() => 0.5),
		hideNowPlaying: vi.fn(),
		onCommand: (listener: (command: 'play' | 'pause') => void) => {
			onCommand = listener;

			return () => undefined;
		},
		onHeadphonesLost: (listener: () => void) => {
			onHeadphonesLost = listener;

			return () => undefined;
		},
		onInterruption: (listener: (isInterrupted: boolean) => void) => {
			onInterruption = listener;

			return () => undefined;
		},
		onVolumeChange: (listener: (volume: number) => void) => {
			onVolumeChange = listener;

			return () => undefined;
		},
		openMicrophone: vi.fn(async () => {
			const track = { stop: vi.fn() };

			tracks.push(track);

			return track;
		}),
		requestMicrophone: vi.fn(async () => ({ canAskAgain: true, granted: true })),
		setAudioMode: vi.fn(async () => undefined),
		showNowPlaying: vi.fn()
	} satisfies VoiceNative;

	return {
		api,
		command: (command: 'play' | 'pause') => onCommand?.(command),
		interrupt: (isInterrupted: boolean) => onInterruption?.(isInterrupted),
		unplug: () => onHeadphonesLost?.(),
		volume: (volume: number) => onVolumeChange?.(volume),
		lastPeer: () => peers.at(-1) as ReturnType<typeof fakePeer>,
		peers,
		tracks
	};
};

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

const TEXTS = {
	channel: 'Reader’s voice',
	listener: (name: string | null, status: string) => `${name ?? 'Member'} · ${status}`,
	play: 'Listen',
	reading: 'Your voice is on',
	stop: 'Stop',
	title: (kind: string) => `Read together · ${kind}`
};

const snapshot = (overrides: Partial<Extract<LiveServerFrame, { t: 'snapshot' }>> = {}): LiveServerFrame => ({
	mark: null,
	markShown: false,
	people: [
		{ isLeader: true, isListening: false, isYou: false, name: 'Ayşe' },
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

const setup = ({ hasNative = true } = {}) => {
	const socket = fakeConnection();
	const native = fakeNative();
	const session = createLiveSession({
		end: vi.fn(async () => ({ success: true })),
		now: () => Date.now(),
		open: socket.open as never,
		start: vi.fn(async () => ({ code: 'LEAD2345', kind: 'CEVSEN' as const }))
	});
	const api = {
		answer: vi.fn(async () => ({ success: true as const })),
		listen: vi.fn(async () => ({
			iceServers: [{ credential: 'c', urls: 'turn:turn.example:3478', username: 'u' }],
			listenerSessionId: 'listener-1',
			offer: { sdp: 'cloudflare-offer', type: 'offer' as const }
		})),
		start: vi.fn(async () => ({
			answer: { sdp: 'cloudflare-answer', type: 'answer' as const },
			iceServers: [{ credential: 'c', urls: 'turn:turn.example:3478', username: 'u' }]
		})),
		stop: vi.fn(async () => ({ success: true as const })),
		stopListening: vi.fn(async () => ({ success: true as const }))
	};
	const voice = createLiveVoice({
		...api,
		native: hasNative ? native.api : null,
		now: () => Date.now(),
		random: () => 0.5,
		session
	});

	voice.setTexts(TEXTS);

	const frame = (next: LiveServerFrame) => socket.handlersOf().onFrame(next);
	const announce = (next: LiveVoice) => frame({ t: 'voice', voice: next });

	return { announce, api, frame, native, session, socket, voice };
};

/** Lets every pending promise in the voice's chains run. */
const settle = async () => {
	for (let turn = 0; turn < 20; turn += 1) {
		await Promise.resolve();
	}
};

const joinAsReader = (context: ReturnType<typeof setup>) => {
	context.session.join('LEAD2345', 'CEVSEN');
	context.frame(snapshot({ role: 'leader' }));
};

const joinAsFollower = (context: ReturnType<typeof setup>, voice: LiveVoice = 'on') => {
	context.session.join('ABCD2345', 'CEVSEN');
	context.frame(snapshot({ voice }));
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('live voice — the reader', () => {
	it('asks for the microphone only when turned on, then publishes it to the API', async () => {
		const context = setup();
		const { api, native, voice } = context;

		joinAsReader(context);
		expect(native.api.requestMicrophone).not.toHaveBeenCalled();
		expect(voice.getSnapshot()).toMatchObject({ role: 'reader', state: 'off' });

		await voice.start();
		await settle();

		expect(native.api.requestMicrophone).toHaveBeenCalledTimes(1);
		expect(native.api.setAudioMode).toHaveBeenCalledWith('reading');
		expect(api.start).toHaveBeenCalledWith('session-1', { mid: '0', sdp: 'reader-offer' });
		expect(native.lastPeer().peer.accept).toHaveBeenCalledWith('cloudflare-answer');
		expect(voice.getSnapshot().state).toBe('connecting');

		native.lastPeer().setState('connected');
		expect(voice.getSnapshot().state).toBe('listening');
		// The microphone's foreground service on Android, and the socket kept in the background.
		expect(native.api.showNowPlaying).toHaveBeenLastCalledWith(
			expect.objectContaining({ isPlaying: true, role: 'reading', subtitle: 'Your voice is on' })
		);
		expect(context.socket.held.at(-1)).toBe(true);
	});

	it('stays off with the reason when the microphone is refused', async () => {
		const context = setup();
		const { api, native, voice } = context;

		native.api.requestMicrophone.mockResolvedValueOnce({ canAskAgain: false, granted: false });
		joinAsReader(context);
		await voice.start();
		await settle();

		expect(voice.getSnapshot()).toMatchObject({ reason: 'microphone-refused', state: 'off' });
		expect(native.api.openMicrophone).not.toHaveBeenCalled();
		expect(api.start).not.toHaveBeenCalled();
	});

	it('waits for the socket before publishing', async () => {
		const context = setup();
		const { api, voice } = context;

		joinAsReader(context);
		context.socket.handlersOf().onState('connecting');
		await voice.start();
		await settle();
		expect(api.start).not.toHaveBeenCalled();

		context.frame(snapshot({ role: 'leader' }));
		await settle();
		expect(api.start).toHaveBeenCalledTimes(1);
	});

	it('tells the room it is paused when it cannot send, and on when it can again', async () => {
		const context = setup();
		const { native, socket, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();
		native.lastPeer().setState('connected');
		expect(socket.sent).toEqual([]);

		native.lastPeer().setState('disconnected');
		expect(voice.getSnapshot().state).toBe('paused');
		native.lastPeer().setState('connected');

		// A call takes the microphone.
		native.interrupt(true);
		native.interrupt(false);

		expect(socket.sent).toEqual([
			{ state: 'paused', t: 'voice' },
			{ state: 'on', t: 'voice' },
			{ state: 'paused', t: 'voice' },
			{ state: 'on', t: 'voice' }
		]);
	});

	it('publishes again with growing waits when the connection fails, through TURN from then on', async () => {
		const context = setup();
		const { api, native, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();
		native.lastPeer().setState('failed');

		expect(voice.getSnapshot().state).toBe('paused');
		expect(context.socket.sent).toEqual([{ state: 'paused', t: 'voice' }]);

		await vi.advanceTimersByTimeAsync(999);
		expect(api.start).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		await settle();

		expect(api.start).toHaveBeenCalledTimes(2);
		// The first connection had only STUN; the next one has the answer's TURN servers.
		expect(native.peers[0]?.iceServers).toEqual([]);
		expect(native.lastPeer().iceServers).toEqual([
			{ credential: 'c', urls: 'turn:turn.example:3478', username: 'u' }
		]);
		// The microphone is kept, not asked for again.
		expect(native.api.openMicrophone).toHaveBeenCalledTimes(1);
		expect(native.api.requestMicrophone).toHaveBeenCalledTimes(1);

		// Failing again waits twice as long.
		native.lastPeer().setState('failed');
		await vi.advanceTimersByTimeAsync(1999);
		expect(api.start).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		await settle();
		expect(api.start).toHaveBeenCalledTimes(3);
	});

	it('gives up a connection that does not come up in time and makes it again', async () => {
		const context = setup();
		const { api, native, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();

		await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);
		expect(native.peers[0]?.peer.close).toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);
		await settle();
		expect(api.start).toHaveBeenCalledTimes(2);
	});

	it('back on the socket: says it is on when it still sends, publishes again when the room lost it', async () => {
		const context = setup();
		const { api, native, socket, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();
		native.lastPeer().setState('connected');

		// The socket dropped and came back; the room had the voice paused meanwhile.
		socket.handlersOf().onState('connecting');
		context.frame(snapshot({ role: 'leader', voice: 'paused' }));
		await settle();

		expect(socket.sent).toEqual([{ state: 'on', t: 'voice' }]);
		expect(api.start).toHaveBeenCalledTimes(1);

		// A restarted server lost the room's voice: published again.
		context.frame(snapshot({ role: 'leader', voice: 'off' }));
		await settle();

		expect(api.start).toHaveBeenCalledTimes(2);
		expect(native.peers[0]?.peer.close).toHaveBeenCalled();
		// It had been heard: a reconnection reads as paused, not as starting.
		expect(voice.getSnapshot().state).toBe('paused');
		native.lastPeer().setState('connected');
		expect(voice.getSnapshot().state).toBe('listening');
	});

	it('turns off: tells the API, lets go of the microphone, the audio and the background', async () => {
		const context = setup();
		const { api, native, socket, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();
		native.lastPeer().setState('connected');

		voice.stop();
		await settle();

		expect(api.stop).toHaveBeenCalledWith('session-1');
		expect(native.tracks[0]?.stop).toHaveBeenCalled();
		expect(native.lastPeer().peer.close).toHaveBeenCalled();
		expect(native.api.setAudioMode).toHaveBeenLastCalledWith('off');
		expect(native.api.hideNowPlaying).toHaveBeenCalled();
		expect(socket.held.at(-1)).toBe(false);
		expect(voice.getSnapshot().state).toBe('off');
	});

	it('turned off while the API answered: off again on the server, and the microphone let go', async () => {
		const context = setup();
		const { api, native, voice } = context;
		let answer: () => void = () => undefined;

		api.start.mockImplementationOnce(
			() =>
				new Promise(resolve => {
					answer = () =>
						resolve({
							answer: { sdp: 'cloudflare-answer', type: 'answer' },
							iceServers: []
						});
				})
		);
		joinAsReader(context);
		await voice.start();
		await settle();

		voice.stop();
		expect(api.stop).not.toHaveBeenCalled();
		answer();
		await settle();

		expect(api.stop).toHaveBeenCalledWith('session-1');
		expect(native.tracks[0]?.stop).toHaveBeenCalled();
		expect(native.lastPeer().peer.accept).not.toHaveBeenCalled();
	});

	it('says why it is paused: a call, or the connection', async () => {
		const context = setup();
		const { native, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();
		native.lastPeer().setState('connected');

		native.interrupt(true);
		expect(voice.getSnapshot()).toMatchObject({ pauseReason: 'call', state: 'paused' });
		native.interrupt(false);

		native.lastPeer().setState('disconnected');
		expect(voice.getSnapshot()).toMatchObject({ pauseReason: 'network', state: 'paused' });
	});

	it('turns off and goes unavailable when the service stays gone thirty seconds, with the socket up', async () => {
		const context = setup();
		const { api, native, voice } = context;

		api.start.mockRejectedValue(httpError(502));
		joinAsReader(context);
		await voice.start();
		await settle();

		await vi.advanceTimersByTimeAsync(SERVICE_GIVE_UP_MS - 1);
		expect(voice.getSnapshot().state).not.toBe('unavailable');
		await vi.advanceTimersByTimeAsync(1);

		expect(voice.getSnapshot().state).toBe('unavailable');
		expect(native.tracks[0]?.stop).toHaveBeenCalled();
		expect(native.api.hideNowPlaying).toHaveBeenCalled();
	});

	it('waits as long as it takes while the phone itself is offline', async () => {
		const context = setup();
		const { native, socket, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();
		native.lastPeer().setState('connected');

		// No network: the socket is down too.
		socket.handlersOf().onState('connecting');
		native.lastPeer().setState('disconnected');
		await vi.advanceTimersByTimeAsync(SERVICE_GIVE_UP_MS * 2);

		expect(voice.getSnapshot().state).toBe('paused');
	});

	it('after a start overtaken (409) with the room’s voice off, publishes again only after a wait', async () => {
		const context = setup();
		const { api, native, voice } = context;

		api.start.mockRejectedValueOnce(httpError(409));
		joinAsReader(context);
		await voice.start();
		await settle();

		expect(native.peers[0]?.peer.close).toHaveBeenCalled();
		expect(api.start).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000);
		await settle();
		expect(api.start).toHaveBeenCalledTimes(2);
	});

	it('after a start overtaken (409) while the room already has a voice, settles off — even if the room spoke first', async () => {
		const context = setup();
		const { api, frame, native, voice } = context;
		let reject: (error: unknown) => void = () => undefined;

		api.start.mockImplementationOnce(() => new Promise((_resolve, fail) => (reject = fail)));
		joinAsReader(context);
		await voice.start();
		await settle();

		// The rejoin's snapshot arrives before the 409: another start of this reader's holds the voice.
		frame(snapshot({ role: 'leader', voice: 'on' }));
		reject(httpError(409));
		await settle();
		await vi.advanceTimersByTimeAsync(60_000);

		expect(voice.getSnapshot().state).toBe('off');
		expect(native.tracks[0]?.stop).toHaveBeenCalled();
		expect(api.start).toHaveBeenCalledTimes(1);
		// Its own start was refused: there is nothing of its own to stop at the server.
		expect(api.stop).not.toHaveBeenCalled();
	});

	it('stays off when its own stop overtook the start: the later 409 changes nothing', async () => {
		const context = setup();
		const { api, native, voice } = context;
		let reject: (error: unknown) => void = () => undefined;

		api.start.mockImplementationOnce(() => new Promise((_resolve, fail) => (reject = fail)));
		joinAsReader(context);
		await voice.start();
		await settle();

		// "Sesi kapat" while the start is on its way; the server's stop overtakes it (room off).
		voice.stop();
		reject(httpError(409));
		await settle();
		await vi.advanceTimersByTimeAsync(60_000);

		expect(api.start).toHaveBeenCalledTimes(1);
		expect(voice.getSnapshot().state).toBe('off');
		expect(native.tracks[0]?.stop).toHaveBeenCalled();
	});

	it('does not post an offer for a start cancelled while the offer was being made', async () => {
		const context = setup();
		const { api, native, voice } = context;
		let finishOffer: () => void = () => undefined;

		native.api.createPeer.mockImplementationOnce((iceServers: unknown[]) => {
			const created = fakePeer(iceServers);

			created.peer.offer.mockImplementationOnce(
				() => new Promise(resolve => (finishOffer = () => resolve({ mid: '0', sdp: 'late' })))
			);
			native.peers.push(created);

			return created.peer;
		});
		joinAsReader(context);
		await voice.start();
		await settle();

		voice.stop();
		finishOffer();
		await settle();

		expect(api.start).not.toHaveBeenCalled();
	});

	it('says unavailable when the server has no voice set up', async () => {
		const context = setup();
		const { api, native, voice } = context;

		api.start.mockRejectedValueOnce(httpError(503));
		joinAsReader(context);
		await voice.start();
		await settle();

		expect(voice.getSnapshot().state).toBe('unavailable');
		expect(native.tracks[0]?.stop).toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(api.start).toHaveBeenCalledTimes(1);
	});

	it('reads its own microphone’s level only while a meter is on screen', async () => {
		const context = setup();
		const { native, voice } = context;

		joinAsReader(context);
		await voice.start();
		await settle();
		native.lastPeer().setState('connected');
		await vi.advanceTimersByTimeAsync(1000);
		// No meter: a reader's connection is not sampled at all.
		expect(native.lastPeer().peer.sample).not.toHaveBeenCalled();

		const unsubscribe = voice.level.subscribe(() => undefined);

		await vi.advanceTimersByTimeAsync(LEVEL_INTERVAL_MS * 3);
		expect(voice.level.get().loudness).toBeCloseTo(loudnessOf(0.1));

		unsubscribe();
		const calls = native.lastPeer().peer.sample.mock.calls.length;

		await vi.advanceTimersByTimeAsync(2000);
		expect(native.lastPeer().peer.sample.mock.calls.length - calls).toBeLessThanOrEqual(1);
		expect(voice.level.get().loudness).toBe(0);
	});
});

describe('levelBetween', () => {
	const sample = (energy: number | null, duration: number | null, level: number | null = 0.9) => ({
		duration,
		energy,
		level,
		packets: null
	});

	it('is the RMS over the interval: sqrt(Δenergy / Δduration)', () => {
		const next = levelBetween(sample(1.5, 10.5), { duration: 10, energy: 1.5 - 0.01 * 0.5 });

		expect(next.level).toBeCloseTo(0.1);
		expect(next.baseline).toEqual({ duration: 10.5, energy: 1.5 });
	});

	it('says nothing on the first sample, and keeps it as the baseline', () => {
		expect(levelBetween(sample(2, 20), null)).toEqual({ baseline: { duration: 20, energy: 2 }, level: null });
	});

	it('says nothing when no audio passed, keeping the old baseline', () => {
		const previous = { duration: 20, energy: 2 };

		expect(levelBetween(sample(2, 20), previous)).toEqual({ baseline: previous, level: null });
	});

	it('starts again when the counters go backwards — a restarted stream', () => {
		expect(levelBetween(sample(0.01, 0.2), { duration: 20, energy: 2 })).toEqual({
			baseline: { duration: 0.2, energy: 0.01 },
			level: null
		});
	});

	it('falls back to audioLevel only when the energy is not there', () => {
		expect(levelBetween(sample(null, null, 0.2), { duration: 20, energy: 2 })).toEqual({
			baseline: null,
			level: 0.2
		});
		expect(levelBetween(sample(null, null, null), null)).toEqual({ baseline: null, level: null });
	});

	it('is silence when the energy did not grow', () => {
		expect(levelBetween(sample(2, 20.12), { duration: 20, energy: 2 }).level).toBe(0);
	});
});

describe('loudnessOf', () => {
	it('maps WebRTC’s linear level to how loud it sounds, between a room’s hiss and close speech', () => {
		expect(loudnessOf(0)).toBe(0);
		expect(loudnessOf(-1)).toBe(0);
		expect(loudnessOf(Number.NaN)).toBe(0);
		// -45 dB and below: silence.
		expect(loudnessOf(0.005)).toBe(0);
		// Quiet speech (-30 dB) already lifts the bars well off rest; normal speech most of the way.
		expect(loudnessOf(10 ** (-30 / 20))).toBeCloseTo(15 / 35);
		expect(loudnessOf(0.1)).toBeCloseTo(25 / 35);
		// -10 dB and up: full.
		expect(loudnessOf(0.32)).toBe(1);
		expect(loudnessOf(1)).toBe(1);
	});

	it('rises with the level', () => {
		const levels = [0.006, 0.01, 0.03, 0.1, 0.2];
		const loudness = levels.map(loudnessOf);

		loudness.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(loudness[index] ?? 1));
	});
});

describe('live voice — a follower', () => {
	it('plays nothing until they tap, then listens to the reader through the API', async () => {
		const context = setup();
		const { api, native, voice } = context;

		joinAsFollower(context);
		await settle();
		expect(voice.getSnapshot()).toMatchObject({ role: 'listener', room: 'on', state: 'off' });
		expect(api.listen).not.toHaveBeenCalled();
		expect(native.api.showNowPlaying).not.toHaveBeenCalled();

		voice.listen();
		await settle();

		expect(native.api.setAudioMode).toHaveBeenCalledWith('listening');
		expect(api.listen).toHaveBeenCalledWith('session-1');
		expect(native.lastPeer().iceServers).toEqual([
			{ credential: 'c', urls: 'turn:turn.example:3478', username: 'u' }
		]);
		expect(native.lastPeer().peer.answer).toHaveBeenCalledWith('cloudflare-offer');
		expect(api.answer).toHaveBeenCalledWith('session-1', {
			listenerSessionId: 'listener-1',
			sdp: 'listener-answer'
		});
		expect(voice.getSnapshot().state).toBe('connecting');

		native.lastPeer().setState('connected');
		expect(voice.getSnapshot().state).toBe('listening');
		expect(native.api.showNowPlaying).toHaveBeenLastCalledWith({
			channelName: 'Reader’s voice',
			isPlaying: true,
			playLabel: 'Listen',
			role: 'listening',
			stopLabel: 'Stop',
			subtitle: 'Ayşe · live',
			title: 'Read together · CEVSEN'
		});
		expect(context.socket.held.at(-1)).toBe(true);
	});

	it('stops by their own choice, tells the server, keeps play on the lock screen a while, and starts again live', async () => {
		const context = setup();
		const { api, native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		native.command('pause');
		expect(voice.getSnapshot().state).toBe('stopped');
		expect(native.lastPeer().peer.close).toHaveBeenCalled();
		// The reader's list stops saying "dinliyor".
		expect(api.stopListening).toHaveBeenCalledWith('session-1', { listenerSessionId: 'listener-1' });
		expect(native.api.showNowPlaying).toHaveBeenLastCalledWith(
			expect.objectContaining({ isPlaying: false, subtitle: 'Ayşe · stopped' })
		);
		expect(native.api.hideNowPlaying).not.toHaveBeenCalled();

		// Play from the lock screen: a new connection, where the reader is now.
		native.command('play');
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(2);
		expect(native.peers).toHaveLength(2);
	});

	it('takes the stopped entry off the lock screen after a few minutes', async () => {
		const context = setup();
		const { native, socket, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		voice.stop();

		await vi.advanceTimersByTimeAsync(STOPPED_PANEL_MS - 1);
		expect(native.api.hideNowPlaying).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(native.api.hideNowPlaying).toHaveBeenCalled();
		expect(socket.held.at(-1)).toBe(false);
		expect(voice.getSnapshot().state).toBe('stopped');
	});

	it('follows the reader’s voice: paused keeps the connection; off closes it with a short notice, and on is heard again without a tap', async () => {
		const context = setup();
		const { announce, api, native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		announce('paused');
		expect(voice.getSnapshot().state).toBe('paused');
		expect(native.lastPeer().peer.close).not.toHaveBeenCalled();

		announce('off');
		expect(voice.getSnapshot()).toMatchObject({ room: 'off', state: 'notice' });
		expect(native.lastPeer().peer.close).toHaveBeenCalled();
		// Let go at the server as every closed connection is — safe, though it forgot every listener itself.
		expect(api.stopListening).toHaveBeenCalledTimes(1);
		// The lock screen stays, saying the voice paused — it comes back by itself.
		expect(native.api.hideNowPlaying).not.toHaveBeenCalled();
		expect(native.api.showNowPlaying).toHaveBeenLastCalledWith(
			expect.objectContaining({ isPlaying: true, role: 'listening' })
		);

		await vi.advanceTimersByTimeAsync(NOTICE_MS);
		expect(voice.getSnapshot().state).toBe('off');

		// One "Dinle" a session: the voice back on is heard again without another tap.
		announce('on');
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(2);
		native.lastPeer().setState('connected');
		expect(voice.getSnapshot().state).toBe('listening');
	});

	it('keeps the choice through a restarted server’s snapshot, which is not the reader turning it off', async () => {
		const context = setup();
		const { api, frame, native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		frame(snapshot({ voice: 'off' }));
		expect(voice.getSnapshot().state).toBe('off');
		frame(snapshot({ voice: 'on' }));
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(2);
	});

	it('reads two seconds without audio as paused, never a shorter gap, and is back when audio is', async () => {
		const context = setup();
		const { native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');
		await vi.advanceTimersByTimeAsync(1000);
		expect(voice.getSnapshot().state).toBe('listening');

		native.lastPeer().audio.isFlowing = false;
		await vi.advanceTimersByTimeAsync(1500);
		expect(voice.getSnapshot().state).toBe('listening');
		await vi.advanceTimersByTimeAsync(1000);
		expect(voice.getSnapshot()).toMatchObject({ room: 'on', state: 'paused' });

		native.lastPeer().audio.isFlowing = true;
		await vi.advanceTimersByTimeAsync(500);
		expect(voice.getSnapshot().state).toBe('listening');
	});

	it('waits and tries again when it has too many attempts in flight (429)', async () => {
		const context = setup();
		const { api, voice } = context;

		api.listen.mockRejectedValueOnce(httpError(429));
		joinAsFollower(context);
		voice.listen();
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1000);
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(2);
	});

	it('lets go at the server of an attempt it gave up on, so none is left in flight', async () => {
		const context = setup();
		const { api, native, voice } = context;
		let answer: () => void = () => undefined;

		api.answer.mockImplementationOnce(() => new Promise(resolve => (answer = () => resolve({ success: true }))));
		joinAsFollower(context);
		voice.listen();
		await settle();

		// Stopped while the answer was on its way.
		voice.stop();
		answer();
		await settle();

		expect(api.stopListening).toHaveBeenCalledWith('session-1', { listenerSessionId: 'listener-1' });
		expect(native.lastPeer().peer.close).toHaveBeenCalled();

		// A failed answer lets its session go too, before the retry.
		voice.listen();
		api.answer.mockRejectedValueOnce(httpError(502));
		await settle();
		expect(api.stopListening).toHaveBeenCalledTimes(2);
	});

	it('lets go at the server of a connection that failed, before listening again', async () => {
		const context = setup();
		const { api, native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		native.lastPeer().setState('failed');
		expect(api.stopListening).toHaveBeenCalledWith('session-1', { listenerSessionId: 'listener-1' });
	});

	it('releases the background hold when the session ends while listening', async () => {
		const context = setup();
		const { frame, native, socket, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');
		expect(socket.held.at(-1)).toBe(true);

		frame({ reason: 'ended', t: 'ended' });
		expect(socket.held.at(-1)).toBe(false);
	});

	it('stops when the headphones come out, rather than play on the speaker', async () => {
		const context = setup();
		const { api, native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		native.unplug();
		expect(voice.getSnapshot().state).toBe('stopped');
		expect(api.stopListening).toHaveBeenCalled();
	});

	it('reads the received level only while a meter is on screen, as loudness', async () => {
		const context = setup();
		const { native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');
		await vi.advanceTimersByTimeAsync(1000);
		expect(voice.level.get().loudness).toBe(0);
		const quiet = native.lastPeer().peer.sample.mock.calls.length;

		const unsubscribe = voice.level.subscribe(() => undefined);

		await vi.advanceTimersByTimeAsync(LEVEL_INTERVAL_MS * 4);
		expect(voice.level.get().loudness).toBeCloseTo(loudnessOf(0.1));
		// Read four times as often as for the pause check alone.
		expect(native.lastPeer().peer.sample.mock.calls.length - quiet).toBeGreaterThanOrEqual(3);

		// Silence brings the bars down.
		native.lastPeer().audio.level = 0;
		await vi.advanceTimersByTimeAsync(LEVEL_INTERVAL_MS * 2);
		expect(voice.level.get().loudness).toBe(0);

		native.lastPeer().audio.level = 0.1;
		await vi.advanceTimersByTimeAsync(LEVEL_INTERVAL_MS * 2);
		unsubscribe();
		expect(voice.level.get().loudness).toBe(0);
	});

	it('derives the level from the running energy when the stats carry it', async () => {
		const context = setup();
		const { native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');
		native.lastPeer().audio.hasEnergy = true;

		const unsubscribe = voice.level.subscribe(() => undefined);

		// The first sample only sets the baseline.
		await vi.advanceTimersByTimeAsync(LEVEL_INTERVAL_MS);
		expect(voice.level.get().loudness).toBe(0);

		await vi.advanceTimersByTimeAsync(LEVEL_INTERVAL_MS * 2);
		expect(voice.level.get().loudness).toBeCloseTo(loudnessOf(0.1));
		unsubscribe();
	});

	it('keeps publishing a steady voice, so the bars keep swaying', async () => {
		const context = setup();
		const { native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		const heard = vi.fn();
		const unsubscribe = voice.level.subscribe(heard);

		await vi.advanceTimersByTimeAsync(LEVEL_INTERVAL_MS * 5);
		expect(heard.mock.calls.length).toBeGreaterThanOrEqual(4);
		unsubscribe();
	});

	it('says the phone’s volume is all the way down while listening', async () => {
		const context = setup();
		const { native, voice } = context;

		native.api.getOutputVolume.mockReturnValueOnce(0);
		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');
		expect(voice.getSnapshot().isVolumeOff).toBe(true);

		native.volume(0.4);
		expect(voice.getSnapshot().isVolumeOff).toBe(false);
	});

	it('listens again on every `on` while connected — the reader may have published a new track', async () => {
		const context = setup();
		const { announce, api, native, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		announce('on');
		await settle();

		expect(native.peers[0]?.peer.close).toHaveBeenCalled();
		expect(api.listen).toHaveBeenCalledTimes(2);
	});

	it('listens while the voice is paused, and waits when it went off meanwhile', async () => {
		const context = setup();
		const { api, voice } = context;

		joinAsFollower(context, 'paused');
		voice.listen();
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(1);

		// Off by the time the request arrived: no retry until the next `on`.
		const second = setup();

		joinAsFollower(second);
		second.api.listen.mockRejectedValueOnce(httpError(409));
		second.voice.listen();
		await settle();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(second.api.listen).toHaveBeenCalledTimes(1);

		// The reader's voice on again (it was re-published before the socket said off).
		second.announce('on');
		await settle();
		expect(second.api.listen).toHaveBeenCalledTimes(2);
	});

	it('tries again with growing waits when the API or Cloudflare fails', async () => {
		const context = setup();
		const { api, voice } = context;

		api.listen.mockRejectedValueOnce(httpError(502)).mockRejectedValueOnce(httpError(502));
		joinAsFollower(context);
		voice.listen();
		await settle();
		expect(voice.getSnapshot().state).toBe('connecting');

		await vi.advanceTimersByTimeAsync(1000);
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(1999);
		expect(api.listen).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		await settle();
		expect(api.listen).toHaveBeenCalledTimes(3);
	});

	it('lets go of everything when the session ends, is left, or the account signs out', async () => {
		const context = setup();
		const { native, session, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();
		native.lastPeer().setState('connected');

		context.frame({ reason: 'ended', t: 'ended' });
		await settle();

		expect(native.lastPeer().peer.close).toHaveBeenCalled();
		expect(native.api.hideNowPlaying).toHaveBeenCalled();
		expect(native.api.setAudioMode).toHaveBeenLastCalledWith('off');
		expect(voice.getSnapshot()).toMatchObject({ role: null, state: 'off' });

		// A new session starts clean: nothing plays until they tap again.
		session.leave();
		joinAsFollower(context);
		await settle();
		expect(voice.getSnapshot().state).toBe('off');
		expect(native.peers).toHaveLength(1);

		voice.listen();
		await settle();
		voice.reset();
		expect(native.lastPeer().peer.close).toHaveBeenCalled();
		expect(voice.getSnapshot().state).toBe('off');
	});
});

describe('live voice — without the native pieces', () => {
	it('is unavailable and asks for nothing', async () => {
		const context = setup({ hasNative: false });
		const { api, voice } = context;

		joinAsFollower(context);
		voice.listen();
		await settle();

		expect(voice.getSnapshot().state).toBe('unavailable');
		expect(api.listen).not.toHaveBeenCalled();
	});
});
