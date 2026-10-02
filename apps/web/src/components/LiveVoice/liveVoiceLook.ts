import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { LiveSessionState } from '@/lib/hooks/useLiveSession';
import type { LiveVoiceSnapshot } from '@/lib/live/liveVoice';
import { pluralKey } from '@/lib/i18n/plural';
import type { AppLanguage, StringKey } from '@/lib/i18n/strings';
import { formatLivePlace } from '@/screens/Live/liveFormat';

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

/** The design's three tones (Birlikte Oku Ses): live sage, sand while paused, grey for the notice. */
export type LiveVoiceTone = 'live' | 'warn' | 'calm';

export type LiveVoiceAction = 'turnOff' | 'listen' | 'stop';

export type LiveVoiceLook = {
	tone: LiveVoiceTone;
	/** The live bar under the reader's header. */
	title: string;
	sub: string;
	/** The bar's 38pt disc: the level meter, or a glyph. */
	lead: 'meter' | IconName;
	/** The return strip's two lines. */
	stripTitle: string;
	stripSub: string;
	/** The reader's own glyph in the strip's disc; a follower's disc keeps the reader's initials. */
	stripGlyph: IconName | null;
	/** The corner badge on the strip's disc. */
	badge: 'meter' | 'pause' | 'speaker' | null;
	/** The one-row accessory's text — the shortest form, never cut. */
	short: string;
	/** Always labelled, never a glyph alone. */
	button: { action: LiveVoiceAction; label: string; icon: IconName; isPrimary: boolean } | null;
	/** What a screen reader hears for the bar, and once when the state changes. */
	spoken: string;
};

const VOWELS = 'aıoueiöü';
const ACCUSATIVE_VOWEL: Record<string, string> = { a: 'ı', e: 'i', ı: 'ı', i: 'i', o: 'u', ö: 'ü', u: 'u', ü: 'ü' };

/**
 * **"Ayşe Yılmaz’ı", "Ali’yi"** — a name in the Turkish accusative, for "… dinliyorsun". The
 * suffix follows the name's last vowel, with a `y` after a vowel; an apostrophe sets it off, as
 * it does for every proper noun. A name with no Turkish vowel is left as it is.
 */
export const withAccusativeTr = (name: string) => {
	const lower = name.toLocaleLowerCase('tr');
	const lastVowel = Array.from(lower)
		.reverse()
		.find(letter => VOWELS.includes(letter));

	if (!lastVowel) {
		return name;
	}

	const endsInVowel = VOWELS.includes(Array.from(lower).at(-1) ?? '');

	return `${name}’${endsInVowel ? 'y' : ''}${ACCUSATIVE_VOWEL[lastVowel]}`;
};

const firstNameOf = (name: string) => name.split(/\s+/).find(word => word.length > 0) ?? name;

/**
 * What live voice says, wherever it says it (Birlikte Oku Ses, lanes C–F): the live bar, the
 * return strip, the one-row accessory, and the screen reader. Null when voice has nothing to say
 * — off, unavailable, an old build — and the session's own look stands as it is.
 */
export const describeLiveVoice = (
	voice: LiveVoiceSnapshot,
	state: Pick<LiveSessionState, 'gone' | 'people' | 'readerPlace'>,
	t: Translate,
	language: AppLanguage
): LiveVoiceLook | null => {
	if (!voice.isSupported || state.gone !== null || voice.role === null) {
		return null;
	}

	const leader = state.people.find(person => person.isLeader);
	const readerName = leader?.name ?? t('anonymousMember');
	const firstName = firstNameOf(readerName);
	const place = state.readerPlace ? formatLivePlace(state.readerPlace, t) : '';
	const followers = state.people.filter(person => !person.isLeader);
	const listenerCount = followers.filter(person => person.isListening === true).length;

	if (voice.role === 'reader') {
		const turnOff = {
			action: 'turnOff' as const,
			icon: 'micOff' as const,
			isPrimary: false,
			label: t('liveVoiceTurnOff')
		};

		if (voice.state === 'listening' || voice.state === 'connecting') {
			const following = t(
				pluralKey(language, followers.length, 'liveVoiceFollowingOne', 'liveVoiceFollowingOther'),
				{
					count: followers.length
				}
			);
			const listening =
				listenerCount > 0
					? t(pluralKey(language, listenerCount, 'liveVoiceListeningOne', 'liveVoiceListeningOther'), {
							count: listenerCount
					  })
					: t('liveVoiceListeningNone');

			return {
				badge: 'meter',
				button: turnOff,
				lead: 'meter',
				short: t('liveVoiceOnTitle'),
				spoken: `${t('liveVoiceOnTitle')}. ${listening}.`,
				stripGlyph: 'micOn',
				stripSub: place,
				stripTitle: `${t('liveVoiceOnTitle')} · ${following}`,
				sub: `${following} · ${listening}`,
				title: t('liveVoiceOnTitle'),
				tone: 'live'
			};
		}

		if (voice.state === 'paused') {
			const sub = voice.pauseReason === 'call' ? t('liveVoicePausedCall') : t('liveVoicePausedNetwork');

			return {
				badge: 'pause',
				button: turnOff,
				lead: 'micPaused',
				short: t('liveVoicePausedTitle'),
				spoken: `${t('liveVoicePausedTitle')}. ${sub}.`,
				stripGlyph: 'micPaused',
				stripSub: sub,
				stripTitle: t('liveVoicePausedTitle'),
				sub,
				title: t('liveVoicePausedTitle'),
				tone: 'warn'
			};
		}

		return null;
	}

	const stop = { action: 'stop' as const, icon: 'stop' as const, isPrimary: false, label: t('liveVoiceNotifyStop') };

	if (voice.state === 'notice') {
		return {
			badge: null,
			button: null,
			lead: 'micOff',
			short: t('liveVoiceNoticeTitle', { name: firstName }),
			spoken: `${t('liveVoiceNoticeTitle', { name: readerName })}. ${t('liveVoiceNoticeSub')}.`,
			stripGlyph: null,
			stripSub: t('liveVoiceNoticeStripSub'),
			stripTitle: t('liveVoiceNoticeTitle', { name: readerName }),
			sub: t('liveVoiceNoticeSub'),
			title: t('liveVoiceNoticeTitle', { name: readerName }),
			tone: 'calm'
		};
	}

	if (voice.state === 'listening' || voice.state === 'connecting') {
		const title = t('liveVoiceListeningTo', {
			name: language === 'tr' ? withAccusativeTr(readerName) : readerName
		});
		const live = t('liveVoiceLiveSub', { place });
		const sub = voice.isVolumeOff ? t('liveVoiceVolumeOff') : live;

		return {
			badge: 'meter',
			button: stop,
			lead: 'meter',
			short: t('liveVoiceListeningShort'),
			spoken: `${title}. ${sub}.`,
			stripGlyph: null,
			stripSub: sub,
			stripTitle: title,
			sub,
			title,
			tone: 'live'
		};
	}

	if (voice.state === 'paused') {
		return {
			badge: 'pause',
			button: stop,
			lead: 'speakerPaused',
			short: t('liveVoicePausedShort'),
			spoken: `${t('liveVoiceReaderPausedTitle')}. ${t('liveVoiceReaderPausedSub')}.`,
			stripGlyph: null,
			stripSub: t('liveVoiceReaderPausedSub'),
			stripTitle: t('liveVoiceReaderPausedTitle'),
			sub: t('liveVoiceReaderPausedSub'),
			title: t('liveVoiceReaderPausedTitle'),
			tone: 'warn'
		};
	}

	// Not listening — never asked, or stopped — while the reader's voice is there to hear.
	if ((voice.state === 'off' || voice.state === 'stopped') && voice.room !== 'off') {
		return {
			badge: 'speaker',
			button: { action: 'listen', icon: 'speaker', isPrimary: true, label: t('liveVoiceNotifyListen') },
			lead: 'speaker',
			short: t('liveVoiceReadingAloud', { name: firstName }),
			spoken: `${t('liveVoiceReadingAloud', { name: readerName })}.`,
			stripGlyph: null,
			stripSub: t('liveVoiceAvailStripSub'),
			stripTitle: t('liveVoiceReadingAloud', { name: readerName }),
			sub: t('liveVoiceAvailSub'),
			title: t('liveIsReading', { name: readerName }),
			tone: 'live'
		};
	}

	return null;
};
