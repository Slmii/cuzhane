import { LiveVoiceMeter } from '@/components/LiveVoice/LiveVoiceMeter.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, MonoText, Typography } from '@/components/ui/Typography/Typography.component';
import { useLiveVoice, useLiveVoiceLook } from '@/lib/hooks/useLiveVoice';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { liveVoice } from '@/lib/live/liveVoice';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { formatInviteCode } from '@/lib/utils/inviteCode';
import { LiveDot } from '@/screens/Live/LiveDot.component';
import { formatCountdown, formatLivePlace, LIVE_GRACE_SECONDS } from '@/screens/Live/liveFormat';
import { LiveTeachRow } from '@/screens/Live/LiveTeachRow.component';
import { LIVE_BAR_HEIGHT, LiveVoiceBar } from '@/screens/Live/LiveVoiceBar.component';
import type { useFreeReaderLive } from '@/screens/Live/useFreeReaderLive';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

type Props = {
	live: ReturnType<typeof useFreeReaderLive>;
	/**
	 * Which way the reader's line is from a detached follower's screen ("Göster"), for the arrow on
	 * "Takip et": up when it is above what they see, down otherwise and when there is no line.
	 */
	followDirection?: 'up' | 'down';
	onOpenSheet: () => void;
};

/** How many followers' initials the leader's row shows before "+N". */
const MAX_AVATARS = 3;
/** The voice's mark in place of the dot: the mark box's height (the meter's bars overhang its width a little). */
const VOICE_MARK_SIZE = 14;

/** The countdown while the reader is away, ticking only while it shows. Also the return strip's. */
export const useSecondsLeft = (awaySince: number | null) => {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (awaySince === null) {
			return;
		}

		const timer = setInterval(() => setNow(Date.now()), 1000);

		return () => clearInterval(timer);
	}, [awaySince]);

	return awaySince === null ? 0 : Math.max(0, LIVE_GRACE_SECONDS - Math.floor((now - awaySince) / 1000));
};

type Look = {
	background: string;
	border: string;
	title: string;
	sub: string;
	titleColor: string;
	subColor: string;
	mark: 'spin' | 'pulse' | 'ring' | 'warm' | 'grey' | 'red';
	isTappable: boolean;
};

/**
 * The live row under a free reader's header (Birlikte oku, lanes B–E) — the one thing that tells
 * the reader's screen and a follower's apart. One row, eight states: connecting, the reader's
 * own (nobody yet, with the code; or N following, with their initials), a follower following or
 * let go, waiting for a reader who dropped out, ended, and a code that found nothing.
 *
 * **"Takip et" is one button that changes, never one that pops in.** While following it reads
 * "Takip ediyorsun", outlined and inert; once the follower scrolls or turns a page themselves it
 * becomes "Takip et", filled, and takes them back to the reader's place. A native button mounted
 * on the spot draws its first frame unplaced.
 */
export const LiveBar = ({ followDirection = 'down', live, onOpenSheet }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const { code, state } = live;
	const secondsLeft = useSecondsLeft(state.status === 'away' && live.isFollower ? state.awaySince : null);
	const voiceLook = useLiveVoiceLook(state);
	const voice = useLiveVoice();

	if (code === null) {
		return null;
	}

	/*
	 * **Voice takes a follower's bar while it has something to say** (Birlikte Oku Ses) — but not
	 * over the reader dropping out, whose countdown stands (lane J, "Duraklama"), nor over a
	 * follower who let go, whose bar is "Takip et". The reader's own bar stays as it is: their voice
	 * is the mic button beside the code, on and off.
	 */
	const isVoiceBar =
		voiceLook !== null && state.gone === null && state.status === 'live' && live.isFollower && !state.isDetached;

	if (isVoiceBar) {
		return <LiveVoiceBar look={voiceLook} onOpenSheet={onOpenSheet} />;
	}

	const leader = state.people.find(person => person.isLeader);
	const followers = state.people.filter(person => !person.isLeader);
	const place = state.readerPlace ? formatLivePlace(state.readerPlace, t) : '';
	const readerName = leader?.name ?? t('anonymousMember');

	const green = {
		background: theme.colors.accentSoft,
		border: toAlphaColor(theme.colors.accent, 0.16),
		subColor: toAlphaColor(theme.colors.text, 0.6),
		titleColor: theme.colors.text
	};
	const neutral = {
		background: theme.colors.surfaceMuted,
		border: toAlphaColor(theme.colors.text, 0.08),
		subColor: toAlphaColor(theme.colors.text, 0.55),
		titleColor: theme.colors.text
	};

	const look: Look =
		state.gone === 'not-found'
			? {
					background: theme.colors.missedSurface,
					border: toAlphaColor(theme.colors.missed, 0.18),
					isTappable: false,
					mark: 'red',
					sub: t('liveNotFoundSub'),
					subColor: theme.colors.danger,
					title: t('liveNotFound'),
					titleColor: theme.colors.danger
			  }
			: state.gone !== null
			? { ...neutral, isTappable: false, mark: 'grey', sub: t('liveEndedBarSub'), title: t('liveEndedTitle') }
			: state.status === 'connecting'
			? { ...neutral, isTappable: false, mark: 'spin', sub: t('liveConnectingSub'), title: t('liveConnecting') }
			: live.isLeader
			? {
					...green,
					isTappable: true,
					mark: 'pulse',
					sub: followers.length > 0 ? t('liveLiveNSub') : t('liveLive0Sub'),
					title: followers.length > 0 ? t('liveLiveN', { count: followers.length }) : t('liveLive0')
			  }
			: state.status === 'away'
			? {
					background: theme.colors.sand,
					border: toAlphaColor(theme.colors.sandText, 0.16),
					isTappable: true,
					mark: 'warm',
					sub: t('liveWaitingSub'),
					subColor: toAlphaColor(theme.colors.sandText, 0.85),
					title: t('liveWaiting'),
					titleColor: theme.colors.sandText
			  }
			: {
					...green,
					isTappable: true,
					mark: state.isDetached ? 'ring' : 'pulse',
					sub: state.isDetached ? t('liveDetachedSub') : place,
					title: t('liveIsReading', { name: readerName })
			  };

	const markColor =
		look.mark === 'warm'
			? theme.colors.poolLine
			: look.mark === 'grey'
			? toAlphaColor(theme.colors.text, 0.3)
			: look.mark === 'red'
			? theme.colors.missed
			: theme.colors.accent;

	const isLiveLeader = live.isLeader && state.gone === null && state.status !== 'connecting';
	/*
	 * **The reader's voice is one button beside the code** — a struck-through mic while muted, the
	 * mic in accent while it is on (connecting and paused count as on: the reader asked for it,
	 * and tapping again turns it off). A refused microphone opens the sheet instead, which says
	 * why and leads to Settings; a build or server without voice shows no button at all.
	 */
	const hasVoiceToggle =
		isLiveLeader && voice.isSupported && voice.role === 'reader' && voice.state !== 'unavailable';
	const isVoiceOn = voice.state === 'connecting' || voice.state === 'listening' || voice.state === 'paused';
	/*
	 * While the reader's voice is on, the live dot gives way to the voice's own mark (Birlikte Oku
	 * Ses): the level meter in the accent, or — paused — the paused microphone in sand, never
	 * moving bars. Off, the dot stays.
	 */
	const voiceMark = hasVoiceToggle && look.mark === 'pulse' && isVoiceOn ? voice.state : null;
	const toggleVoice = () => {
		if (isVoiceOn) {
			liveVoice.stop();
		} else if (voice.reason === 'microphone-refused') {
			onOpenSheet();
		} else {
			void liveVoice.start();
		}
	};

	return (
		<>
			<View style={[styles.bar, { backgroundColor: look.background, borderBottomColor: look.border }]}>
				<Pressable
					accessibilityRole='button'
					disabled={!look.isTappable}
					onPress={onOpenSheet}
					style={styles.tapArea}
				>
					<View style={styles.markBox}>
						{look.mark === 'spin' ? (
							<ActivityIndicator color={theme.colors.text} size='small' style={styles.spinner} />
						) : voiceMark === 'paused' ? (
							<Icon
								color={theme.colors.liveStripWarnAccent}
								name='micPaused'
								size={VOICE_MARK_SIZE}
								strokeWidth={1.6}
							/>
						) : voiceMark !== null ? (
							<LiveVoiceMeter color={markColor} size={VOICE_MARK_SIZE} />
						) : (
							<LiveDot
								color={markColor}
								isPulsing={look.mark === 'pulse' || look.mark === 'warm'}
								isRing={look.mark === 'ring'}
							/>
						)}
					</View>
					<View style={styles.copy}>
						<Typography color={look.titleColor} numberOfLines={1} style={styles.title} weight='semibold'>
							{look.title}
						</Typography>
						{look.sub ? (
							<CaptionText color={look.subColor} numberOfLines={1} style={styles.sub}>
								{look.sub}
							</CaptionText>
						) : null}
					</View>
				</Pressable>

				{/*
				 * **Outside the bar's tap areas, not inside one.** On iOS the button is a native glass
				 * control, which does not take the touch away from a Pressable around it: inside the
				 * tap area, muting also opened the sheet.
				 */}
				{hasVoiceToggle ? (
					<AppButton
						accessibilityLabel={isVoiceOn ? t('liveVoiceTurnOff') : t('liveVoiceRowTitle')}
						fullWidth={false}
						icon={isVoiceOn ? 'mic' : 'micOff'}
						onPress={toggleVoice}
						size='sm'
						variant={isVoiceOn ? 'accent' : 'surface'}
					/>
				) : null}

				<Pressable
					accessibilityElementsHidden
					disabled={!look.isTappable}
					importantForAccessibility='no-hide-descendants'
					onPress={onOpenSheet}
					style={styles.sideTapArea}
				>
					{isLiveLeader && followers.length === 0 ? (
						<View
							style={[
								styles.codeChip,
								{
									backgroundColor: theme.colors.surface,
									borderColor: toAlphaColor(theme.colors.accent, 0.22)
								}
							]}
						>
							<MonoText style={styles.codeChipText}>{formatInviteCode(code)}</MonoText>
						</View>
					) : null}
					{isLiveLeader && followers.length > 0 ? (
						<View style={styles.avatars}>
							{followers.slice(0, MAX_AVATARS).map((person, index) => (
								<Avatar
									key={index}
									name={person.name ?? t('anonymousMember')}
									size={28}
									style={[styles.avatar, { borderColor: theme.colors.accentSoft }]}
								/>
							))}
							{followers.length > MAX_AVATARS ? (
								<MonoText color={theme.colors.accent} style={styles.more}>{`+${
									followers.length - MAX_AVATARS
								}`}</MonoText>
							) : null}
						</View>
					) : null}
					{isLiveLeader ? (
						<Icon color={toAlphaColor(theme.colors.text, 0.34)} name='chevronRight' size={16} />
					) : null}
					{live.isFollower && state.status === 'away' ? (
						<MonoText color={theme.colors.sandText} style={styles.timer}>
							{formatCountdown(secondsLeft)}
						</MonoText>
					) : null}
				</Pressable>

				{state.gone !== null ? (
					<AppButton fullWidth={false} onPress={live.leave} size='sm' title={t('close')} variant='surface' />
				) : live.isFollower && state.status === 'live' ? (
					<AppButton
						disabled={!state.isDetached}
						fullWidth={false}
						// Following: a tick. Detached: which way the reader's line went (v2, R2).
						icon={state.isDetached ? (followDirection === 'up' ? 'arrowUp' : 'arrowDown') : 'check'}
						onPress={live.follow}
						size='sm'
						style={styles.followButton}
						title={state.isDetached ? t('liveFollow') : t('liveFollowing')}
						variant={state.isDetached ? 'accent' : 'accentOutline'}
					/>
				) : null}
			</View>
			{/* "Göster"'s hint for the reader — the first reading together only. */}
			{isLiveLeader ? <LiveTeachRow store={live.markStore} /> : null}
		</>
	);
};

/* The design's measures (Birlikte oku, the live row). */
const styles = StyleSheet.create({
	avatar: {
		borderWidth: 2,
		marginLeft: -8
	},
	avatars: {
		alignItems: 'center',
		flexDirection: 'row',
		marginLeft: 8
	},
	bar: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		/*
		 * **One height in every state**, the voice bar's (`LiveVoiceBar`, 66): a follower's bar swaps
		 * between this one and that one as the reader mutes and unmutes, and must not jump.
		 */
		height: LIVE_BAR_HEIGHT,
		paddingBottom: 10,
		paddingLeft: 18,
		paddingRight: 14,
		paddingTop: 10
	},
	codeChip: {
		borderRadius: 8,
		borderWidth: 1,
		paddingHorizontal: 8,
		paddingVertical: 6
	},
	codeChipText: {
		fontSize: 12,
		letterSpacing: 0.7
	},
	copy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	followButton: {
		minWidth: 140
	},
	markBox: {
		alignItems: 'center',
		height: 14,
		justifyContent: 'center',
		width: 14
	},
	more: {
		fontSize: 11,
		marginLeft: 5
	},
	spinner: {
		transform: [{ scale: 0.7 }]
	},
	sub: {
		fontSize: 12,
		lineHeight: 16
	},
	tapArea: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 12
	},
	/** The code (or initials) and the chevron: the same tap as the rest of the bar. */
	sideTapArea: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	timer: {
		fontSize: 12
	},
	title: {
		fontSize: 13.5,
		lineHeight: 17.5
	}
});
