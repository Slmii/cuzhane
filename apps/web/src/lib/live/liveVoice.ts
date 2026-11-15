import {
	answerLiveVoice,
	listenLiveVoice,
	startLiveVoice,
	stopListeningLiveVoice,
	stopLiveVoice
} from '@/api/live.api';
import { liveSession, type LiveSessionStore } from '@/lib/live/liveSession';
import {
	voiceNative,
	type VoiceNative,
	type VoicePeer,
	type VoicePeerState,
	type VoiceSample,
	type VoiceTrack
} from '@/lib/live/voiceNative';
import type { LiveIceServer, LiveReadingKind, LiveVoice } from '@/lib/types/domain';
import type { LiveVoiceAudioMode, LiveVoiceCommand, LiveVoiceNowPlaying } from '../../../modules/live-voice';

/**
 * **Live voice, for the whole app** — the reader's voice going out, or a follower hearing it,
 * beside the live reading it belongs to (`lib/live/liveSession`) and built the same way: plain
 * module state, `subscribe`/`getSnapshot`, hooks in `lib/hooks/useLiveVoice`.
 *
 * The voice travels through Cloudflare over WebRTC (`voiceNative`); our API only lets people in
 * and hands over the descriptions; the socket says whether the reader's voice is on, off or
 * paused (`LiveSessionState.voice`, and every announcement through `liveSession.onVoice`).
 *
 * - **The reader** turns it on (`start` — the microphone is asked for then, and only then; a
 *   refusal leaves it off with the reason) and off (`stop`). When it cannot send — no network, a
 *   call took the microphone — it says `paused` on the socket, and `on` once it can again. A
 *   connection that fails is published again, with growing waits; after the socket comes back,
 *   it tells the room its voice is on, or publishes again if the room lost it. **The service
 *   gone** (the socket is up, the voice still cannot get out) for `SERVICE_GIVE_UP_MS`: off, and
 *   unavailable for the rest of the session.
 * - **A follower** taps to listen (`listen`) — never on their own — and keeps listening through
 *   the reader's voice pausing, until they stop (`stop`, which tells the server, so the reader's
 *   list no longer says "dinliyor"). Listening again always joins the reader where they are now.
 *   Every `on` announcement while a connection is up is listened to again: it may be a reader who
 *   published a new track. **The reader turning it off** ends the listening, with a short
 *   `notice`. No audio for `STARVED_MS` reads as paused, without flickering on a short gap.
 *   Headphones coming out stop it — it never moves to the speaker unasked.
 * - **Like a podcast**: the lock-screen entry (iOS) or the notification (Android, a foreground
 *   service) shows while it matters, with play and stop that come back as `play`/`pause`; after a
 *   stop it stays `STOPPED_PANEL_MS`, so play is still there to rejoin.
 * - **It goes with the session**: ended, left, another session, or the account signed out
 *   (`reset`, from the account guard) — the microphone, the playing and the entry all stop.
 *
 * **Unavailable** in a build without the native pieces (`isSupported: false` — no voice controls
 * at all), or when the server has no voice set up.
 */

/** For both roles. `listening` is the voice working — heard by a follower, going out from the reader. */
export type LiveVoiceState = 'off' | 'connecting' | 'listening' | 'paused' | 'stopped' | 'notice' | 'unavailable';

export type LiveVoiceSnapshot = {
	state: LiveVoiceState;
	role: 'reader' | 'listener' | null;
	/** The reader's voice as the room has it — a follower who stopped still sees it is on. */
	room: LiveVoice;
	/** Why a reader's voice stayed off: the microphone was refused — Settings is the way back. */
	reason: 'microphone-refused' | null;
	/** Why the reader's voice is paused: a call took the microphone, or the connection. */
	pauseReason: 'call' | 'network' | null;
	/** False in a build without live voice: no voice controls are shown at all. */
	isSupported: boolean;
	/** A follower hears nothing because the phone's volume is all the way down. */
	isVolumeOff: boolean;
};

/** A follower's line on the lock screen. */
export type LiveVoiceListenerStatus = 'live' | 'paused' | 'stopped';

/** The words outside the app, in the app's language (`useLiveVoiceTexts`). */
export type LiveVoiceTexts = {
	/** "Birlikte oku · Cevşen". */
	title: (kind: LiveReadingKind) => string;
	/** A follower's line: who is reading — null for "Member" — and how the voice is. */
	listener: (readerName: string | null, status: LiveVoiceListenerStatus) => string;
	/** The reader's line: their voice is going out. */
	reading: string;
	play: string;
	stop: string;
	/** Android's notification channel, as Settings lists it. */
	channel: string;
};

/** How loud the voice is, 0 to 1 (`loudnessOf`), and when that was read — what the bars sway by. */
export type LiveVoiceLevel = { loudness: number; sampledAt: number };

/** The meter's view of the level, read only while something subscribes. */
export type LiveVoiceLevelStore = {
	get: () => LiveVoiceLevel;
	subscribe: (listener: () => void) => () => void;
};

type SessionLink = Pick<LiveSessionStore, 'getSnapshot' | 'subscribe' | 'onVoice' | 'sendVoice' | 'holdInBackground'>;

type Deps = {
	native: VoiceNative | null;
	session: SessionLink;
	start: typeof startLiveVoice;
	stop: typeof stopLiveVoice;
	listen: typeof listenLiveVoice;
	answer: typeof answerLiveVoice;
	stopListening: typeof stopListeningLiveVoice;
	random: () => number;
	now: () => number;
};

const BACKOFF_FIRST_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** A connection not up by then (or dropped that long) is given up and made again. */
export const CONNECT_TIMEOUT_MS = 15_000;
/** No audio arriving this long reads as paused — a short gap does not flicker. */
export const STARVED_MS = 2_000;
/** The reader's voice unable to get out this long, with the socket up: the service is gone. */
export const SERVICE_GIVE_UP_MS = 30_000;
/** "Ayşe Yılmaz sesini kapattı", for a follower who was listening. */
export const NOTICE_MS = 4_000;
/** The lock-screen entry stays this long after a stop, with play to rejoin. */
export const STOPPED_PANEL_MS = 5 * 60_000;
/** How often the meter's level is read — and the transition it eases over (lane I: "120 ms yumuşatarak"). */
export const LEVEL_INTERVAL_MS = 120;
/** How often a follower's incoming audio is checked when no meter is showing. */
const STARVED_CHECK_MS = 500;
/** Below this the voice is silent: silence held is not worth a re-render of the meter. */
const LEVEL_STEP = 0.02;
const SILENT_LEVEL: LiveVoiceLevel = { loudness: 0, sampledAt: 0 };
/** The quiet a room has, and speech up close: the dB range the meter spans from rest to full. */
const LEVEL_FLOOR_DB = -45;
const LEVEL_CEILING_DB = -10;

/**
 * **WebRTC's `audioLevel` as the ear hears it.** The level is linear amplitude, 0 to 1, and speech
 * sits at about 0.01–0.3 on it — drawn as it is, the bars barely leave rest. Taken in decibels
 * between `LEVEL_FLOOR_DB` (a room's hiss: 0) and `LEVEL_CEILING_DB` (close speech: 1).
 */
export type EnergyBaseline = { energy: number; duration: number };

/**
 * **The level over the last interval**, from a sample and the one before it. Where the stats carry
 * the running energy, it is the RMS since then — `sqrt(Δenergy / Δduration)`, the standard
 * derivation; `audioLevel` only where they don't. Null when there is nothing to say yet: a first
 * sample (no baseline), no audio in between, or counters that went backwards (restarted) — those
 * start a new baseline.
 */
export const levelBetween = (
	sample: VoiceSample,
	previous: EnergyBaseline | null
): { level: number | null; baseline: EnergyBaseline | null } => {
	if (sample.energy === null || sample.duration === null) {
		return { baseline: null, level: sample.level };
	}

	const baseline = { duration: sample.duration, energy: sample.energy };

	if (!previous) {
		return { baseline, level: null };
	}

	const energy = sample.energy - previous.energy;
	const duration = sample.duration - previous.duration;

	if (energy < 0 || duration < 0) {
		return { baseline, level: null };
	}

	if (duration === 0) {
		return { baseline: previous, level: null };
	}

	return { baseline, level: Math.sqrt(energy / duration) };
};

export const loudnessOf = (level: number) => {
	if (!(level > 0)) {
		return 0;
	}

	const db = 20 * Math.log10(level);

	return Math.max(0, Math.min(1, (db - LEVEL_FLOOR_DB) / (LEVEL_CEILING_DB - LEVEL_FLOOR_DB)));
};

const statusOf = (error: unknown) =>
	typeof error === 'object' && error !== null && 'status' in error ? (error as { status: unknown }).status : null;

const isSameSnapshot = (a: LiveVoiceSnapshot, b: LiveVoiceSnapshot) =>
	(Object.keys(a) as (keyof LiveVoiceSnapshot)[]).every(key => a[key] === b[key]);

export const createLiveVoice = (deps: Deps) => {
	const { native, session } = deps;
	const listeners = new Set<() => void>();
	let texts: LiveVoiceTexts | null = null;

	// The session the voice belongs to, as the live reading has it.
	let sessionId: string | null = null;
	let kind: LiveReadingKind = 'CEVSEN';
	let role: LiveVoiceSnapshot['role'] = null;
	let room: LiveVoice = 'off';
	let readerName: string | null = null;
	let isSocketReady = false;
	/** The server answered that it has no voice set up (503), or the service went for good. */
	let isConfigured = true;

	// The reader's.
	let isAsking = false;
	let wantsOn = false;
	let refusal: LiveVoiceSnapshot['reason'] = null;
	let track: VoiceTrack | null = null;
	/** Published since it was turned on: the room knows the voice, so `paused`/`on` mean something. */
	let isPublished = false;
	let hasConnected = false;
	let isInterrupted = false;
	/** What the room was last told — or, after a (re)join, what it says. */
	let reported: Exclude<LiveVoice, 'off'> | null = null;
	let iceServers: LiveIceServer[] = [];
	let giveUpTimer: ReturnType<typeof setTimeout> | null = null;

	// A follower's.
	let wantsListen = false;
	let isStoppedByMe = false;
	let stoppedPanelTimer: ReturnType<typeof setTimeout> | null = null;
	let isStoppedPanelShown = false;
	/** The server said the voice was off (409) before the socket did: wait for the next `on`. */
	let isAwaitingOn = false;
	let isNoticing = false;
	let noticeTimer: ReturnType<typeof setTimeout> | null = null;
	let listenerSessionId: string | null = null;
	let isStarved = false;
	let lastPackets: number | null = null;
	let lastPacketsAt = 0;
	let isVolumeOff = false;

	// The one connection, the reader's or the follower's.
	let peer: VoicePeer | null = null;
	let peerState: VoicePeerState | null = null;
	let isBusy = false;
	// Each attempt a number of its own, so one given up on acts on nothing when it answers.
	let attemptId = 0;
	let attempt = 0;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;

	// The meter's loudness, and the sampling behind it (also a follower's packet check).
	let level = SILENT_LEVEL;
	// The last sample's running energy, for the level over the next interval (`levelBetween`).
	let energyBaseline: EnergyBaseline | null = null;
	const levelListeners = new Set<() => void>();
	let sampleTimer: ReturnType<typeof setTimeout> | null = null;

	// What the native side was last told, so it is told only of a change.
	let audioMode: LiveVoiceAudioMode = 'off';
	let audioChain: Promise<void> = Promise.resolve();
	let shownNowPlaying: string | null = null;
	let isHolding = false;

	// A function rather than a comparison inline: the state changes across the awaits it is read after.
	const isConnected = () => peerState === 'connected';

	const cannotSend = () => isInterrupted || peer === null || peerState === 'disconnected' || peerState === 'failed';

	const compute = (): LiveVoiceSnapshot => {
		const base = {
			isSupported: native !== null,
			isVolumeOff: false,
			pauseReason: null,
			reason: role === 'reader' ? refusal : null,
			role,
			room
		};

		if (!native || !isConfigured) {
			return { ...base, state: 'unavailable' };
		}

		if (role === 'reader') {
			if (isAsking) {
				return { ...base, state: 'connecting' };
			}

			if (!wantsOn) {
				return { ...base, state: 'off' };
			}

			if (!isPublished) {
				return { ...base, state: 'connecting' };
			}

			const pauseReason = isInterrupted ? ('call' as const) : ('network' as const);

			if (cannotSend() || room === 'paused') {
				return { ...base, pauseReason, state: 'paused' };
			}

			if (isConnected()) {
				return { ...base, state: 'listening' };
			}

			return hasConnected ? { ...base, pauseReason, state: 'paused' } : { ...base, state: 'connecting' };
		}

		if (role === 'listener') {
			// "… sesini kapattı" for a moment — the listening itself holds, and resumes on the next "on".
			if (isNoticing && room === 'off') {
				return { ...base, state: 'notice' };
			}

			if (!wantsListen) {
				return { ...base, state: isStoppedByMe ? 'stopped' : 'off' };
			}

			if (room !== 'on') {
				return { ...base, state: room };
			}

			if (!isConnected()) {
				return { ...base, state: 'connecting' };
			}

			return isStarved ? { ...base, state: 'paused' } : { ...base, isVolumeOff, state: 'listening' };
		}

		return { ...base, state: 'off' };
	};

	let snapshot: LiveVoiceSnapshot = compute();

	const emitIfChanged = () => {
		const next = compute();

		if (!isSameSnapshot(next, snapshot)) {
			snapshot = next;
			listeners.forEach(listener => listener());
		}
	};

	/*
	 * Every reading while there is a voice, so the bars keep swaying on their own cycles; silence
	 * is published once (and a reset to 0 always), then left alone.
	 */
	const setLevel = (next: number) => {
		const isStillSilent = next < LEVEL_STEP && level.loudness < LEVEL_STEP;

		if (isStillSilent && !(next === 0 && level.loudness !== 0)) {
			return;
		}

		level = next === 0 ? SILENT_LEVEL : { loudness: next, sampledAt: deps.now() };
		levelListeners.forEach(listener => listener());
	};

	const applyAudioMode = (mode: LiveVoiceAudioMode) => {
		if (!native || mode === audioMode) {
			return audioChain;
		}

		audioMode = mode;
		audioChain = audioChain.then(() => native.setAudioMode(mode)).catch(() => undefined);

		return audioChain;
	};

	const listenerStatus = (): LiveVoiceListenerStatus =>
		// The reader muted: still listening as far as the follower is concerned, and it comes back by itself.
		!wantsListen ? 'stopped' : snapshot.state === 'paused' || room === 'off' ? 'paused' : 'live';

	const nowPlaying = (): LiveVoiceNowPlaying | null => {
		if (!texts) {
			return null;
		}

		const labels = { channelName: texts.channel, playLabel: texts.play, stopLabel: texts.stop };
		const title = texts.title(kind);

		if (role === 'reader' && wantsOn) {
			return { ...labels, isPlaying: true, role: 'reading', subtitle: texts.reading, title };
		}

		// After a stop the entry stays a while, with play to rejoin — while there is a voice to join.
		if (role === 'listener' && (wantsListen || (isStoppedByMe && isStoppedPanelShown && room !== 'off'))) {
			return {
				...labels,
				isPlaying: wantsListen,
				role: 'listening',
				subtitle: texts.listener(readerName, listenerStatus()),
				title
			};
		}

		return null;
	};

	/** The phone around the voice: its audio, the lock-screen entry, the socket in the background. */
	const syncNative = () => {
		if (!native) {
			return;
		}

		const isReading = role === 'reader' && wantsOn;
		const isListening = role === 'listener' && wantsListen && room !== 'off';

		void applyAudioMode(isReading ? 'reading' : isListening ? 'listening' : 'off');

		const info = nowPlaying();
		const key = info ? JSON.stringify(info) : null;

		if (key !== shownNowPlaying) {
			shownNowPlaying = key;

			if (info) {
				native.showNowPlaying(info);
			} else {
				native.hideNowPlaying();
			}
		}

		const shouldHold = info !== null;

		if (shouldHold !== isHolding) {
			isHolding = shouldHold;
			session.holdInBackground(shouldHold);
		}
	};

	/** The reader tells the room whether its voice can reach anyone — only once it has been published. */
	const syncReport = () => {
		if (role !== 'reader' || !wantsOn || !isPublished || !isSocketReady) {
			return;
		}

		const next = cannotSend() ? 'paused' : 'on';

		if (next !== reported) {
			reported = next;
			session.sendVoice(next);
		}
	};

	const stopTimer = (timer: ReturnType<typeof setTimeout> | null) => {
		if (timer) {
			clearTimeout(timer);
		}

		return null;
	};

	const stopRetry = () => {
		retryTimer = stopTimer(retryTimer);
	};

	const closePeer = () => {
		const ownListener = listenerSessionId;

		attemptId += 1;
		isBusy = false;
		connectTimer = stopTimer(connectTimer);
		sampleTimer = stopTimer(sampleTimer);
		peer?.close();
		peer = null;
		peerState = null;
		listenerSessionId = null;

		/*
		 * **A listener's connection closed for any reason — stopped, failed, replaced — is let go of
		 * at the server too**, so it never counts against the few attempts a person may have (429)
		 * and the reader's list is right. Safe when the server has already forgotten it.
		 */
		if (ownListener !== null && sessionId !== null) {
			void deps.stopListening(sessionId, { listenerSessionId: ownListener }).catch(() => undefined);
		}
		isStarved = false;
		lastPackets = null;
		energyBaseline = null;
		setLevel(0);
	};

	const releaseTrack = () => {
		track?.stop();
		track = null;
	};

	const scheduleRetry = () => {
		stopRetry();

		const wait = Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** attempt) * (0.75 + deps.random() * 0.5);

		attempt += 1;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			reconcile();
		}, wait);
	};

	/** A connection that is not up in time is given up and made again. */
	const armConnectTimer = (target: VoicePeer) => {
		connectTimer = stopTimer(connectTimer);
		connectTimer = setTimeout(() => {
			connectTimer = null;

			if (peer === target && !isConnected()) {
				closePeer();
				scheduleRetry();
				reconcile();
			}
		}, CONNECT_TIMEOUT_MS);
	};

	/*
	 * **The audio as WebRTC counts it**, read while it means something: a follower's incoming
	 * packets always (silence for `STARVED_MS` is a pause), the level only for a meter on screen —
	 * the reader's own microphone or what a listener receives — every `LEVEL_INTERVAL_MS` then,
	 * every `STARVED_CHECK_MS` otherwise.
	 */
	const shouldSample = () => peer !== null && isConnected() && (role === 'listener' || levelListeners.size > 0);

	const sampleOnce = async () => {
		sampleTimer = null;

		const target = peer;

		if (!target || !shouldSample()) {
			energyBaseline = null;
			setLevel(0);
			return;
		}

		const sample = await target.sample().catch(() => null);

		if (peer !== target) {
			return;
		}

		if (sample) {
			if (levelListeners.size > 0) {
				const next = levelBetween(sample, energyBaseline);

				energyBaseline = next.baseline;

				// Nothing to say yet (a first sample, no audio in between): the bars stay where they are.
				if (next.level !== null) {
					setLevel(loudnessOf(next.level));
				}
			} else {
				energyBaseline = null;
				setLevel(0);
			}

			if (role === 'listener' && sample.packets !== null) {
				if (lastPackets === null || sample.packets > lastPackets) {
					lastPackets = sample.packets;
					lastPacketsAt = deps.now();

					if (isStarved) {
						isStarved = false;
						reconcile();
					}
				} else if (!isStarved && deps.now() - lastPacketsAt >= STARVED_MS) {
					isStarved = true;
					reconcile();
				}
			}
		}

		ensureSampling();
	};

	const ensureSampling = () => {
		if (sampleTimer || !shouldSample()) {
			return;
		}

		sampleTimer = setTimeout(
			() => void sampleOnce(),
			levelListeners.size > 0 ? LEVEL_INTERVAL_MS : STARVED_CHECK_MS
		);
	};

	const watch = (target: VoicePeer) => {
		target.onStateChange(next => {
			if (peer !== target) {
				return;
			}

			peerState = next;

			if (next === 'connected') {
				connectTimer = stopTimer(connectTimer);
				attempt = 0;
				hasConnected = true;
				// Counted from here: the first packets have a moment to arrive.
				lastPackets = null;
				lastPacketsAt = deps.now();
			} else if (next === 'disconnected') {
				armConnectTimer(target);
			} else if (next === 'failed') {
				closePeer();
				scheduleRetry();
			}

			reconcile();
		});
	};

	/** The reader's voice stops here: the server is told, the microphone goes back. */
	const stopReading = () => {
		const wasPublished = isPublished;

		isAsking = false;
		wantsOn = false;
		isPublished = false;
		hasConnected = false;
		reported = null;
		giveUpTimer = stopTimer(giveUpTimer);
		closePeer();
		stopRetry();
		releaseTrack();

		if (wasPublished && sessionId) {
			void deps.stop(sessionId).catch(() => undefined);
		}
	};

	/** A follower's listening stops here; the server is told, so the reader's list is right. */
	const stopListening = () => {
		wantsListen = false;
		closePeer();
		stopRetry();
	};

	const fail = (error: unknown) => {
		closePeer();

		const status = statusOf(error);

		if (status === 503) {
			// No voice set up on the server: nothing to retry, and the microphone goes back.
			isConfigured = false;
			wantsOn = false;
			wantsListen = false;
			isPublished = false;
			releaseTrack();
			return;
		}

		// The reader's voice went off meanwhile: a follower waits for the next `on`.
		if (status === 409 && role === 'listener') {
			isAwaitingOn = true;
			return;
		}

		/*
		 * **The reader's start overtaken** — a newer start or a stop got there first. Settled from
		 * the room's voice as it stands now (its word may have come before the 409): off, so
		 * nothing holds it — published again after a wait; on or paused, another start of this
		 * reader's holds it — off here, with nothing of its own to stop at the server.
		 */
		if (status === 409 && role === 'reader') {
			if (room === 'off') {
				scheduleRetry();
				return;
			}

			wantsOn = false;
			isPublished = false;
			hasConnected = false;
			reported = null;
			releaseTrack();
			return;
		}

		scheduleRetry();
	};

	const publish = async () => {
		if (!native || !sessionId) {
			return;
		}

		closePeer();

		const id = attemptId;
		const ownSession = sessionId;
		const isCurrent = () => id === attemptId && wantsOn && sessionId === ownSession;

		isBusy = true;

		try {
			await applyAudioMode('reading');

			if (!track) {
				const opened = await native.openMicrophone();

				if (!isCurrent()) {
					opened.stop();
					return;
				}

				track = opened;
			}

			const next = native.createPeer(iceServers);

			if (!isCurrent()) {
				next.close();
				return;
			}

			peer = next;
			peerState = 'connecting';
			watch(next);

			const offer = await next.offer(track);

			// Stopped while the offer was being made: nothing goes to the server.
			if (!isCurrent()) {
				return;
			}

			const started = await deps.start(ownSession, offer);

			if (!isCurrent()) {
				// Turned off while the server answered: the server has it on now, so off again.
				if (!wantsOn && sessionId === ownSession) {
					void deps.stop(ownSession).catch(() => undefined);
				}

				return;
			}

			// Cloudflare's TURN servers, for the next connection if this one cannot get through.
			iceServers = started.iceServers;
			await next.accept(started.answer.sdp);

			if (!isCurrent()) {
				return;
			}

			// The request announced it `on`; the room hears `paused` from here if it drops.
			isPublished = true;
			reported = 'on';
			isBusy = false;

			if (!isConnected()) {
				armConnectTimer(next);
			}
		} catch (error) {
			if (isCurrent()) {
				fail(error);
			}
		}

		reconcile();
	};

	const listen = async () => {
		if (!native || !sessionId) {
			return;
		}

		closePeer();

		const id = attemptId;
		const ownSession = sessionId;
		const isCurrent = () => id === attemptId && wantsListen && sessionId === ownSession;
		// The listener session this attempt was given, until it is the connection's own.
		let offeredId: string | null = null;

		/*
		 * **An attempt given up on is let go of at the server too.** The server allows a person only
		 * a few listen attempts not yet answered (429), so one left behind — stopped, replaced,
		 * failed — must not count against the next.
		 */
		const abandon = () => {
			if (offeredId !== null) {
				void deps.stopListening(ownSession, { listenerSessionId: offeredId }).catch(() => undefined);
				offeredId = null;
			}
		};

		isBusy = true;

		try {
			await applyAudioMode('listening');

			const offered = await deps.listen(ownSession);

			offeredId = offered.listenerSessionId;

			if (!isCurrent()) {
				abandon();
				return;
			}

			const next = native.createPeer(offered.iceServers);

			peer = next;
			peerState = 'connecting';
			watch(next);

			const sdp = await next.answer(offered.offer.sdp);

			if (!isCurrent()) {
				abandon();
				return;
			}

			await deps.answer(ownSession, { listenerSessionId: offered.listenerSessionId, sdp });

			if (!isCurrent()) {
				abandon();
				return;
			}

			listenerSessionId = offered.listenerSessionId;
			isBusy = false;

			if (!isConnected()) {
				armConnectTimer(next);
			}
		} catch (error) {
			abandon();

			if (isCurrent()) {
				fail(error);
			}
		}

		reconcile();
	};

	/*
	 * **The service gone, not the network**: the socket is up but the reader's voice still cannot
	 * get out (Cloudflare or our API failing) — paused while it retries, then off and unavailable.
	 * Without a socket it is the phone's own network, and it waits as long as that takes.
	 */
	const syncGiveUp = () => {
		const isServiceDown = role === 'reader' && wantsOn && isSocketReady && !isInterrupted && !isConnected();

		if (!isServiceDown) {
			giveUpTimer = stopTimer(giveUpTimer);
			return;
		}

		giveUpTimer ??= setTimeout(() => {
			giveUpTimer = null;
			stopReading();
			isConfigured = false;
			reconcile();
		}, SERVICE_GIVE_UP_MS);
	};

	/** Makes things as they should be: connects what should be connected, then tells everyone. */
	const reconcile = () => {
		const canConnect = native !== null && isConfigured && isSocketReady && !peer && !isBusy && !retryTimer;

		if (canConnect && role === 'reader' && wantsOn) {
			void publish();
		} else if (canConnect && role === 'listener' && wantsListen && room !== 'off' && !isAwaitingOn) {
			// Paused too: the track is still there, and it is heard the moment the reader is back.
			void listen();
		}

		syncReport();
		syncGiveUp();
		ensureSampling();
		emitIfChanged();
		syncNative();
	};

	/** Everything let go — another session, none, or another account. Nothing is asked of the server. */
	const teardown = () => {
		closePeer();
		stopRetry();
		releaseTrack();
		giveUpTimer = stopTimer(giveUpTimer);
		noticeTimer = stopTimer(noticeTimer);
		stoppedPanelTimer = stopTimer(stoppedPanelTimer);
		isAsking = false;
		wantsOn = false;
		refusal = null;
		isPublished = false;
		hasConnected = false;
		isInterrupted = false;
		reported = null;
		wantsListen = false;
		isStoppedByMe = false;
		isStoppedPanelShown = false;
		isAwaitingOn = false;
		isNoticing = false;
		isConfigured = true;
		attempt = 0;

		// Always let go of the background hold — an ended session's socket may still be there.
		if (isHolding) {
			isHolding = false;
			session.holdInBackground(false);
		}
	};

	const syncSession = () => {
		const current = session.getSnapshot();
		const id = current && current.gone === null ? current.sessionId : null;

		if (id !== sessionId) {
			teardown();
			sessionId = id;
		}

		role =
			id === null
				? null
				: current?.role === 'leader'
				? 'reader'
				: current?.role === 'follower'
				? 'listener'
				: null;
		room = id === null ? 'off' : current?.voice ?? 'off';
		kind = current?.kind ?? kind;
		readerName = current?.people.find(person => person.isLeader)?.name ?? null;
		isSocketReady = id !== null && current?.status !== 'connecting';

		// The reader's voice went off: a follower's connection has nothing more to hear.
		if (role === 'listener' && room === 'off' && (peer || isBusy)) {
			closePeer();
			stopRetry();
		}

		reconcile();
	};

	const onAnnouncement = (voice: LiveVoice, isSnapshot: boolean) => {
		if (voice === 'on') {
			isAwaitingOn = false;
			isNoticing = false;
			noticeTimer = stopTimer(noticeTimer);
		}

		/*
		 * **The reader turned their voice off** (a frame, not a rejoin's snapshot, which may be a
		 * restarted server): a follower who was listening is told for a moment. Their "Dinle" holds —
		 * one tap a session ("Dinleme" in the design's rules) — so when the reader turns it on again
		 * they are listening again by themselves; the connection closes in between.
		 */
		if (voice === 'off' && !isSnapshot && role === 'listener' && wantsListen) {
			isNoticing = true;
			noticeTimer = stopTimer(noticeTimer);
			noticeTimer = setTimeout(() => {
				noticeTimer = null;
				isNoticing = false;
				reconcile();
			}, NOTICE_MS);
		}

		syncSession();

		if (role === 'reader' && wantsOn && isSnapshot) {
			// Back on the socket: the room's word stands until the reader says otherwise.
			reported = voice === 'off' ? null : voice;

			// The room lost the voice (a restart): publish it again.
			if (voice === 'off' && isPublished) {
				isPublished = false;
				closePeer();
				stopRetry();
			}

			reconcile();
			return;
		}

		// A new track, perhaps — and the server forgets every listener when the reader publishes again.
		if (role === 'listener' && wantsListen && voice === 'on' && peer) {
			closePeer();
			stopRetry();
			attempt = 0;
			reconcile();
		}
	};

	const onCommand = (command: LiveVoiceCommand) => {
		if (command === 'play') {
			store.listen();
		} else {
			store.stop();
		}
	};

	const onInterruption = (isNowInterrupted: boolean) => {
		isInterrupted = isNowInterrupted;
		reconcile();
	};

	// Out of a follower's ears and onto the speaker is never what they asked for: stop instead.
	const onHeadphonesLost = () => {
		if (role === 'listener' && wantsListen) {
			store.stop();
		}
	};

	const onVolumeChange = (volume: number) => {
		isVolumeOff = volume <= 0;
		reconcile();
	};

	const levelStore: LiveVoiceLevelStore = {
		get: () => level,
		subscribe: listener => {
			if (levelListeners.size === 0) {
				// A meter coming on screen measures from its own first sample, not from one long gone.
				energyBaseline = null;
			}

			levelListeners.add(listener);
			// A slower check already waiting is brought forward to the meter's pace.
			sampleTimer = stopTimer(sampleTimer);
			ensureSampling();

			return () => {
				levelListeners.delete(listener);

				if (levelListeners.size === 0) {
					energyBaseline = null;
					setLevel(0);
				}
			};
		}
	};

	const store = {
		getSnapshot: (): LiveVoiceSnapshot => snapshot,
		subscribe: (listener: () => void) => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
		level: levelStore,

		/** The reader turns their voice on — asking for the microphone first, if never asked. */
		start: async () => {
			if (!native || role !== 'reader' || !isConfigured || wantsOn || isAsking) {
				return;
			}

			const ownSession = sessionId;

			isAsking = true;
			refusal = null;
			emitIfChanged();

			const permission = await native.requestMicrophone().catch(() => ({ canAskAgain: false, granted: false }));

			if (!isAsking || sessionId !== ownSession) {
				return;
			}

			isAsking = false;

			if (!permission.granted) {
				refusal = 'microphone-refused';
				emitIfChanged();
				return;
			}

			wantsOn = true;
			hasConnected = false;
			attempt = 0;
			reconcile();
		},

		/** The reader turns it off; a follower stops listening — and keeps play on the lock screen a while. */
		stop: () => {
			if (role === 'reader') {
				stopReading();
			} else if (role === 'listener' && wantsListen) {
				stopListening();
				isStoppedByMe = true;
				isStoppedPanelShown = true;
				stoppedPanelTimer = stopTimer(stoppedPanelTimer);
				stoppedPanelTimer = setTimeout(() => {
					stoppedPanelTimer = null;
					isStoppedPanelShown = false;
					reconcile();
				}, STOPPED_PANEL_MS);
			}

			reconcile();
		},

		/** A follower listens — live, where the reader is now, even after a stop. */
		listen: () => {
			if (!native || role !== 'listener' || !isConfigured || wantsListen) {
				return;
			}

			wantsListen = true;
			isStoppedByMe = false;
			isStoppedPanelShown = false;
			stoppedPanelTimer = stopTimer(stoppedPanelTimer);
			isAwaitingOn = false;
			isNoticing = false;
			noticeTimer = stopTimer(noticeTimer);
			isVolumeOff = native.getOutputVolume() <= 0;
			attempt = 0;
			stopRetry();
			reconcile();
		},

		/** The words for the lock screen and the notification, from the app's language. */
		setTexts: (next: LiveVoiceTexts) => {
			texts = next;
			// Told again with the new words.
			shownNowPlaying = null;
			reconcile();
		},

		/** Signed out, or another account: everything stops, asking the server for nothing. */
		reset: () => {
			teardown();
			sessionId = null;
			role = null;
			room = 'off';
			reconcile();
		}
	};

	session.subscribe(syncSession);
	session.onVoice(onAnnouncement);
	native?.onCommand(onCommand);
	native?.onInterruption(onInterruption);
	native?.onHeadphonesLost(onHeadphonesLost);
	native?.onVolumeChange(onVolumeChange);
	syncSession();

	return store;
};

export type LiveVoiceStore = ReturnType<typeof createLiveVoice>;

export const liveVoice = createLiveVoice({
	answer: answerLiveVoice,
	listen: listenLiveVoice,
	native: voiceNative,
	now: () => Date.now(),
	random: Math.random,
	session: liveSession,
	start: startLiveVoice,
	stop: stopLiveVoice,
	stopListening: stopListeningLiveVoice
});
