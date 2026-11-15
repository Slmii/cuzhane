import { describeLiveVoice, type LiveVoiceAction, type LiveVoiceLook } from '@/components/LiveVoice/liveVoiceLook';
import type { LiveSessionState } from '@/lib/hooks/useLiveSession';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { liveSession } from '@/lib/live/liveSession';
import { liveVoice, type LiveVoiceLevel, type LiveVoiceSnapshot } from '@/lib/live/liveVoice';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

export type { LiveVoiceSnapshot, LiveVoiceState } from '@/lib/live/liveVoice';

/** Live voice as React sees it: the state for this person's role, the room's voice, and why it stayed off. */
export const useLiveVoice = (): LiveVoiceSnapshot => useSyncExternalStore(liveVoice.subscribe, liveVoice.getSnapshot);

/** What voice says for a session — null when it has nothing to say and the session's own look stands. */
export const useLiveVoiceLook = (
	state: Pick<LiveSessionState, 'gone' | 'people' | 'readerPlace'> | null
): LiveVoiceLook | null => {
	const voice = useLiveVoice();
	const { language, t } = useTranslation();

	return state ? describeLiveVoice(voice, state, t, language) : null;
};

/** The voice buttons' one handler: "Sesi kapat", "Dinle", "Durdur". */
export const useLiveVoiceAction = () =>
	useCallback((action: LiveVoiceAction) => {
		if (action === 'listen') {
			liveVoice.listen();
		} else {
			liveVoice.stop();
		}
	}, []);

const NO_LEVEL = () => () => undefined;
const SILENT: LiveVoiceLevel = { loudness: 0, sampledAt: 0 };
const getSilent = () => SILENT;

/**
 * The meter's level. Subscribing is what starts the sampling, so a meter that is not moving
 * (`isActive` false — Reduce Motion) asks for nothing.
 */
export const useLiveVoiceLevel = (isActive: boolean): LiveVoiceLevel =>
	useSyncExternalStore(isActive ? liveVoice.level.subscribe : NO_LEVEL, isActive ? liveVoice.level.get : getSilent);

/**
 * **The words live voice shows outside the app** — the lock screen, Android's notification and
 * its buttons — in the app's own language, which the phone does not know. Mount once, inside the
 * language provider; it changes only with the language.
 */
export const useLiveVoiceTexts = () => {
	const { t } = useTranslation();

	useEffect(() => {
		liveVoice.setTexts({
			channel: t('liveVoiceNotifyChannel'),
			listener: (readerName, status) =>
				t(
					status === 'paused'
						? 'liveVoiceLockPaused'
						: status === 'stopped'
						? 'liveVoiceLockStopped'
						: 'liveVoiceLockLive',
					{ name: readerName ?? t('anonymousMember') }
				),
			play: t('liveVoiceNotifyListen'),
			reading: t('liveVoiceNotifyReading'),
			stop: t('liveVoiceNotifyStop'),
			title: kind => t(kind === 'CEVSEN' ? 'liveVoiceLockTitleCevsen' : 'liveVoiceLockTitleQuran')
		});
	}, [t]);
};

/**
 * **Each change of the voice is said once** to a screen reader ("durum değişimleri bir kez
 * duyurulur") — wherever the person is in the app, and never repeated while it holds. Listens
 * to the stores directly, so the app above it never re-renders for a voice change. Mount once.
 */
export const useLiveVoiceAnnouncements = () => {
	const { language, t } = useTranslation();
	const lastRef = useRef<string | null>(null);

	useEffect(() => {
		const announce = () => {
			const state = liveSession.getSnapshot();
			const look = state ? describeLiveVoice(liveVoice.getSnapshot(), state, t, language) : null;
			// The state, not its words: a listener count changing is not a new state to announce.
			const key = look ? `${look.tone}:${look.lead}:${look.button?.action ?? ''}` : null;

			if (key !== lastRef.current) {
				// Not the first look: arriving on a screen is not a change.
				if (lastRef.current !== null && look) {
					AccessibilityInfo.announceForAccessibility(look.title);
				}

				lastRef.current = key ?? '';
			}
		};

		announce();

		const unsubscribe = liveVoice.subscribe(announce);

		return () => {
			unsubscribe();
		};
	}, [language, t]);
};
