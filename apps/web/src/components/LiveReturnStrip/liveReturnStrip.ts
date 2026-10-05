import type { LiveSessionState } from '@/lib/hooks/useLiveSession';
import { pluralKey } from '@/lib/i18n/plural';
import type { AppLanguage, StringKey } from '@/lib/i18n/strings';
import { formatInviteCode } from '@/lib/utils/inviteCode';
import { formatCountdown, formatLivePlace } from '@/screens/Live/liveFormat';

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

/** The strip's colour says the state: live (sage), the reader dropped (sand), connecting, ended. */
export type LiveStripTone = 'live' | 'warn' | 'calm' | 'done';

export type LiveStripLook = {
	tone: LiveStripTone;
	title: string;
	sub: string;
	/** The 40pt disc: the live glyph for the reader, the reader's initials for a follower. */
	lead: 'glyph' | 'initials' | 'spinner';
	/** The reader's initials, for `lead: 'initials'`. */
	initials: string;
	isPulsing: boolean;
	/** The 60-second ring round the disc while a follower waits for a dropped reader. */
	hasCountdown: boolean;
	/** Ended: taps do nothing, and only the button ("Tamam") puts the session away. */
	isEnded: boolean;
};

/**
 * Ends the strip has no words for: a code that never found a session, or a join the server
 * refused. Both are the join's own failure, said on the reader that tried it, never "it ended".
 */
const SILENT_ENDS = new Set<LiveSessionState['gone']>(['not-found', 'refused']);

/** Whether there is anything for the strip to say — a session, and not one that never began. */
export const hasLiveStrip = (state: LiveSessionState | null): state is LiveSessionState =>
	state !== null && !SILENT_ENDS.has(state.gone);

/** The free reader a session is read in — the one screen that shows its own live bar instead. */
export const liveReaderRouteFor = (kind: LiveSessionState['kind']) => (kind === 'CEVSEN' ? 'AllBabs' : 'Mushaf');

/** "Ayşe Yılmaz" -> "AY": the first letters of the first two words, upper-cased the Turkish way. */
export const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(word => word.length > 0)
		.slice(0, 2)
		.map(word => Array.from(word)[0] ?? '')
		.join('')
		.toLocaleUpperCase('tr');

/** The countdown rounded up to the quarter minute, so a screen reader hears it every 15 s. */
export const COUNTDOWN_ANNOUNCE_SECONDS = 15;

export const announcedSecondsOf = (secondsLeft: number) =>
	Math.ceil(secondsLeft / COUNTDOWN_ANNOUNCE_SECONDS) * COUNTDOWN_ANNOUNCE_SECONDS;

/**
 * What the strip says for a session (Birlikte oku · Okumaya dönüş, lanes B and C). The reader
 * sees whether anyone follows; a follower sees who reads and where. A reader's own drop is
 * "connecting" to them — only a follower is ever shown the countdown.
 */
export const describeLiveStrip = (
	state: LiveSessionState,
	secondsLeft: number,
	t: Translate,
	language: AppLanguage
): LiveStripLook => {
	const leader = state.people.find(person => person.isLeader);
	const readerName = leader?.name ?? t('anonymousMember');
	const followerCount = state.people.filter(person => !person.isLeader).length;
	const code = t('liveReturnCode', { code: formatInviteCode(state.code.replace(/-/g, '')) });
	const place = state.readerPlace ? formatLivePlace(state.readerPlace, t) : code;
	const isReader = state.role === 'leader';
	const isFollower = state.role === 'follower';
	const base = {
		hasCountdown: false,
		initials: initialsOf(readerName),
		isEnded: false,
		isPulsing: false,
		lead: isFollower ? ('initials' as const) : ('glyph' as const)
	};

	if (state.gone !== null) {
		return {
			...base,
			isEnded: true,
			sub: isFollower
				? t(state.gone === 'leader-left' ? 'liveReturnLeaderLeft' : 'liveReturnEndedAlone')
				: t('liveReturnEndedForAll'),
			title: t('liveEndedTitle'),
			tone: 'done'
		};
	}

	if (state.status === 'connecting' || state.role === null) {
		return {
			...base,
			lead: 'spinner',
			sub: isReader
				? t('liveReturnReconnectingSub')
				: isFollower
				? t('liveReturnConnectingSub', { name: readerName })
				: code,
			title: isReader ? t('liveReturnReconnecting') : t('liveConnecting'),
			tone: 'calm'
		};
	}

	if (isReader) {
		return {
			...base,
			isPulsing: true,
			sub: followerCount > 0 ? place : code,
			title:
				followerCount > 0
					? t(pluralKey(language, followerCount, 'liveReturnLiveOne', 'liveReturnLiveOther'), {
							count: followerCount
					  })
					: t('liveReturnLive0'),
			tone: 'live'
		};
	}

	if (state.status === 'away') {
		return {
			...base,
			hasCountdown: true,
			sub: t('liveReturnDroppedSub', { time: formatCountdown(secondsLeft) }),
			title: t('liveReturnDropped'),
			tone: 'warn'
		};
	}

	return {
		...base,
		isPulsing: true,
		sub: place,
		title: t('liveIsReading', { name: readerName }),
		tone: 'live'
	};
};
