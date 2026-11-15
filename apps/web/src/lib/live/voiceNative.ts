import type { LiveIceServer } from '@/lib/types/domain';
import {
	LiveVoiceNative,
	type LiveVoiceAudioMode,
	type LiveVoiceCommand,
	type LiveVoiceMicrophonePermission,
	type LiveVoiceNowPlaying
} from '../../../modules/live-voice';

/**
 * **The native half of live voice, as the voice store sees it** — `react-native-webrtc` for the
 * connection and our own `modules/live-voice` for the phone around it, behind one small surface
 * so the store can be tested against a fake of it.
 *
 * Null in a build without them: an over-the-air update reaches builds made before live voice,
 * and there the voice is "unavailable" rather than a crash. Both come in one build, so
 * `react-native-webrtc` is only required once our module is known to be there — and in a `try`,
 * as it throws while it loads when its native half is missing.
 */

export type VoicePeerState = 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

/** The microphone, held while the reader's voice is on. */
export type VoiceTrack = { stop: () => void };

/** One WebRTC connection to Cloudflare: the reader's to send, or a listener's to receive. */
export type VoicePeer = {
	/** Reader: the microphone as a send-only track; the offer and the track's `mid` for the API. */
	offer: (track: VoiceTrack) => Promise<{ sdp: string; mid: string }>;
	/** Reader: Cloudflare's answer to that offer. */
	accept: (sdp: string) => Promise<void>;
	/** Listener: Cloudflare's offer of the reader's track; returns our answer. */
	answer: (sdp: string) => Promise<string>;
	onStateChange: (listener: (state: VoicePeerState) => void) => void;
	/**
	 * The audio as WebRTC counts it: its level, 0 to 1 — the reader's own microphone, or what a
	 * listener receives — and, for a listener, how many packets have arrived (the voice has stopped
	 * coming when that stops growing). Null where the stats carry neither.
	 */
	sample: () => Promise<VoiceSample>;
	close: () => void;
};

/**
 * `level` is WebRTC's `audioLevel`; `energy` and `duration` its running `totalAudioEnergy` and
 * `totalSamplesDuration` (seconds), null unless both are there.
 */
export type VoiceSample = {
	level: number | null;
	energy: number | null;
	duration: number | null;
	packets: number | null;
};

export type VoiceNative = {
	requestMicrophone: () => Promise<LiveVoiceMicrophonePermission>;
	openMicrophone: () => Promise<VoiceTrack>;
	createPeer: (iceServers: LiveIceServer[]) => VoicePeer;
	setAudioMode: (mode: LiveVoiceAudioMode) => Promise<void>;
	showNowPlaying: (info: LiveVoiceNowPlaying) => void;
	hideNowPlaying: () => void;
	getOutputVolume: () => number;
	onCommand: (listener: (command: LiveVoiceCommand) => void) => () => void;
	onInterruption: (listener: (isInterrupted: boolean) => void) => () => void;
	onHeadphonesLost: (listener: () => void) => () => void;
	onVolumeChange: (listener: (volume: number) => void) => () => void;
};

type StatsEntry = {
	type?: string;
	kind?: string;
	mediaType?: string;
	audioLevel?: number;
	totalAudioEnergy?: number;
	totalSamplesDuration?: number;
	packetsReceived?: number;
};

/**
 * The audio's own entry in a stats report (libwebrtc M124, as `react-native-webrtc` passes it on
 * whole). The microphone's is its **`media-source`** — `outbound-rtp` carries no level; a
 * listener's level and packets are on the incoming stream's **`inbound-rtp`**. Both carry the
 * running energy and duration the level is best derived from (`levelBetween`), and `audioLevel`
 * for when they don't.
 */
export const readSample = (report: { forEach: (each: (entry: StatsEntry) => void) => void }): VoiceSample => {
	const sample: VoiceSample = { duration: null, energy: null, level: null, packets: null };

	report.forEach(entry => {
		const isAudio = entry.kind === 'audio' || entry.mediaType === 'audio';

		if (!isAudio || (entry.type !== 'media-source' && entry.type !== 'inbound-rtp')) {
			return;
		}

		if (typeof entry.audioLevel === 'number') {
			sample.level = entry.audioLevel;
		}

		if (typeof entry.totalAudioEnergy === 'number' && typeof entry.totalSamplesDuration === 'number') {
			sample.energy = entry.totalAudioEnergy;
			sample.duration = entry.totalSamplesDuration;
		}

		if (entry.type === 'inbound-rtp' && typeof entry.packetsReceived === 'number') {
			sample.packets = entry.packetsReceived;
		}
	});

	return sample;
};

type WebRtc = typeof import('react-native-webrtc');
type MediaStream = InstanceType<WebRtc['MediaStream']>;

/** Before a reader's first answer brings Cloudflare's TURN servers: its public STUN. */
const DEFAULT_ICE_SERVERS: LiveIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

const toPeerState = (state: string): VoicePeerState =>
	state === 'connected' || state === 'disconnected' || state === 'failed' || state === 'closed'
		? state
		: 'connecting';

const createVoiceNative = (webrtc: WebRtc, module: NonNullable<typeof LiveVoiceNative>): VoiceNative => {
	// The tracks handed out, so `offer` can find the real one behind the store's plain handle.
	const streams = new WeakMap<VoiceTrack, MediaStream>();

	return {
		createPeer: iceServers => {
			const connection = new webrtc.RTCPeerConnection({
				bundlePolicy: 'max-bundle',
				iceServers: iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS
			});

			return {
				accept: async sdp => {
					await connection.setRemoteDescription({ sdp, type: 'answer' });
				},
				answer: async sdp => {
					await connection.setRemoteDescription({ sdp, type: 'offer' });

					const answer = await connection.createAnswer();

					await connection.setLocalDescription(answer);

					return connection.localDescription?.sdp ?? answer.sdp;
				},
				close: () => connection.close(),
				offer: async track => {
					const microphone = streams.get(track)?.getAudioTracks()[0];

					if (!microphone) {
						throw new Error('No microphone track to offer');
					}

					const transceiver = connection.addTransceiver(microphone, { direction: 'sendonly' });
					const offer = await connection.createOffer({});

					await connection.setLocalDescription(offer);

					if (!transceiver.mid) {
						throw new Error('The microphone track has no mid');
					}

					return { mid: transceiver.mid, sdp: connection.localDescription?.sdp ?? offer.sdp };
				},
				onStateChange: listener => {
					connection.onconnectionstatechange = () => listener(toPeerState(connection.connectionState));
				},
				sample: async () => readSample((await connection.getStats()) as Parameters<typeof readSample>[0])
			};
		},
		getOutputVolume: () => module.getOutputVolume(),
		hideNowPlaying: () => module.hideNowPlaying(),
		onHeadphonesLost: listener => {
			const subscription = module.addListener('onHeadphonesLost', () => listener());

			return () => subscription.remove();
		},
		onVolumeChange: listener => {
			const subscription = module.addListener('onVolumeChange', event => listener(event.volume));

			return () => subscription.remove();
		},
		onCommand: listener => {
			const subscription = module.addListener('onCommand', event => listener(event.command));

			return () => subscription.remove();
		},
		onInterruption: listener => {
			const subscription = module.addListener('onInterruption', event => listener(event.isInterrupted));

			return () => subscription.remove();
		},
		openMicrophone: async () => {
			const stream = await webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
			const track: VoiceTrack = {
				stop: () => {
					stream.getTracks().forEach(each => each.stop());
					stream.release();
				}
			};

			streams.set(track, stream);

			return track;
		},
		requestMicrophone: () => module.requestMicrophonePermission(),
		setAudioMode: mode => module.setAudioMode(mode),
		showNowPlaying: info => module.showNowPlaying(info)
	};
};

const load = (): VoiceNative | null => {
	if (!LiveVoiceNative) {
		return null;
	}

	try {
		return createVoiceNative(require('react-native-webrtc') as WebRtc, LiveVoiceNative);
	} catch {
		return null;
	}
};

export const voiceNative = load();
