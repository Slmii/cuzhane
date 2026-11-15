import type { NativeModule } from 'expo';

/**
 * **Live voice's own native module** — what `react-native-webrtc` leaves to the app: how the
 * phone's audio is set up, the lock-screen entry with its play and stop, and on Android the
 * foreground service that keeps the voice going with the screen off. The connection itself is
 * `react-native-webrtc`'s; `src/lib/live/liveVoice.ts` drives both.
 *
 * - **iOS**: the audio session through WebRTC's own `RTCAudioSession`, so the two never fight over
 *   it; Now Playing (`MPNowPlayingInfoCenter`) and its play/pause commands; a call or another app
 *   taking the audio is reported as an interruption.
 * - **Android**: a foreground service with a media notification — `mediaPlayback` while listening,
 *   `microphone` while reading — whose buttons come back as commands; losing the audio focus (a
 *   call) is reported as an interruption.
 * - **Both**: headphones coming out (`onHeadphonesLost`), and the phone's volume (`getOutputVolume`,
 *   `onVolumeChange`) so a listener at zero is told why they hear nothing.
 *
 * Optional: a build without the module gets `null` here, and live voice says it is unavailable
 * rather than crashing — an over-the-air update reaches builds made before it existed.
 */

/** Listening: the voice on the speaker, playing on when locked. Reading: microphone and speaker. */
export type LiveVoiceAudioMode = 'listening' | 'reading' | 'off';

/** The lock-screen entry (iOS) or the service's notification (Android). Texts come from the app's language. */
export type LiveVoiceNowPlaying = {
	role: 'listening' | 'reading';
	title: string;
	subtitle: string;
	isPlaying: boolean;
	/** Android's buttons and its notification channel; iOS draws its own play/pause. */
	playLabel: string;
	stopLabel: string;
	channelName: string;
};

export type LiveVoiceCommand = 'play' | 'pause';

export type LiveVoiceMicrophonePermission = { granted: boolean; canAskAgain: boolean };

type LiveVoiceEvents = {
	/** Play or stop from the lock screen, the notification, headphones or a car. */
	onCommand: (event: { command: LiveVoiceCommand }) => void;
	/** A call (or another app) took the audio, or gave it back. */
	onInterruption: (event: { isInterrupted: boolean }) => void;
	/** Headphones came out (unplugged, or Bluetooth gone): listening stops rather than go to the speaker. */
	onHeadphonesLost: () => void;
	/** The phone's own volume moved, 0 to 1. */
	onVolumeChange: (event: { volume: number }) => void;
};

export declare class LiveVoiceModule extends NativeModule<LiveVoiceEvents> {
	setAudioMode(mode: LiveVoiceAudioMode): Promise<void>;
	/** Asks only if not answered yet; `canAskAgain: false` means only Settings can change it. */
	requestMicrophonePermission(): Promise<LiveVoiceMicrophonePermission>;
	showNowPlaying(info: LiveVoiceNowPlaying): void;
	hideNowPlaying(): void;
	/** The volume the voice plays at, 0 to 1 — 0 is "Telefonun sesi kısık". */
	getOutputVolume(): number;
}

let loaded: LiveVoiceModule | null = null;

/*
 * Required in a `try`, like `@expo/ui`: `requireOptionalNativeModule` answers null for a module
 * the build does not have, and the `try` covers a runtime that cannot look at all (web).
 */
try {
	const { requireOptionalNativeModule } = require('expo') as typeof import('expo');

	loaded = requireOptionalNativeModule<LiveVoiceModule>('LiveVoice');
} catch {
	loaded = null;
}

export const LiveVoiceNative = loaded;
