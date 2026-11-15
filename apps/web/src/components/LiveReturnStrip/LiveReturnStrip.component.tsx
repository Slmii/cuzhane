import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressRing } from '@/components/ui/ProgressRing/ProgressRing.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useSecondsLeft } from '@/screens/Live/LiveBar.component';
import { Ripple } from '@/components/ui/Ripple/Ripple.component';
import { formatCountdown, LIVE_GRACE_SECONDS } from '@/screens/Live/liveFormat';
import { useEffect, useState } from 'react';
import {
	AccessibilityInfo,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
	type AccessibilityActionEvent
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { announcedSecondsOf, describeLiveStrip } from './liveReturnStrip';
import { toneColors, voiceToneColors } from './liveStripTones';
import { LiveVoiceBadge } from '@/components/LiveVoice/LiveVoiceLead.component';
import { useLiveVoiceAction, useLiveVoiceLook } from '@/lib/hooks/useLiveVoice';
import type { LiveReturnStripProps } from './LiveReturnStrip.types';

/** At this text size and up the button takes a line of its own ("çok büyük yazı"). */
const STACKED_FONT_SCALE = 1.6;
const STATE_TRANSITION_MS = 350;
const RISE_MS = 240;
const RISE_DISTANCE = 24;
const LEAD_SIZE = 40;
const RING_SIZE = 48;
const RING_STROKE = 2.5;

/**
 * The session whose strip has already risen into view: only its **first** appearance rises. Kept
 * at module scope so a remount of the strip — after the app reloads it — does not rise again.
 */
let risenForCode: string | null = null;

/** The design's connecting mark: a ring with its top open, turning. Still under Reduce Motion. */
const Spinner = ({ color }: { color: string }) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();

	return (
		<Animated.View
			style={{
				...styles.spinner,
				borderColor: color,
				borderTopColor: theme.colors.transparent,
				...(isReducedMotion
					? {}
					: {
							animationDuration: '0.9s',
							animationIterationCount: 'infinite',
							animationName: {
								from: { transform: [{ rotate: '0deg' }] },
								to: { transform: [{ rotate: '360deg' }] }
							},
							animationTimingFunction: 'linear'
					  })
			}}
		/>
	);
};

/**
 * **The return-to-reading strip** (Birlikte oku · Okumaya dönüş). While a live reading runs and
 * the reader is elsewhere, it sits at the foot of every screen, says the session is still on and
 * takes them back in one tap — the whole strip, not only its button, which just says what a tap
 * does. Ended, it says so once and waits for "Tamam".
 *
 * One accessibility element: its title and line, and what a double tap does. The countdown is
 * announced every quarter minute rather than read out every second.
 *
 * **Live voice** (Birlikte Oku Ses, lane E) takes the words, the tone and the button while it has
 * something to say: a badge in the disc's corner, and "Sesi kapat", "Dinle" or "Durdur" as a
 * button of its own beside the strip's tap, which still goes back to reading.
 */
export const LiveReturnStrip = ({ bottom, onDismiss, onHeightChange, onReturn, state }: LiveReturnStripProps) => {
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const isReducedMotion = useReducedMotion();
	const { fontScale } = useWindowDimensions();
	const secondsLeft = useSecondsLeft(
		state.role === 'follower' && state.status === 'away' && state.gone === null ? state.awaySince : null
	);
	const [shouldRise] = useState(() => risenForCode !== state.code);

	useEffect(() => {
		risenForCode = state.code;
	}, [state.code]);

	const look = describeLiveStrip(state, secondsLeft, t, language);
	const voiceLook = useLiveVoiceLook(state);
	const onVoiceAction = useLiveVoiceAction();
	/*
	 * **Voice speaks on the strip while it has something to say** (Birlikte Oku Ses, lane E) — not
	 * over connecting, the dropped reader's countdown, or the end, which keep their own words.
	 */
	const voice = look.isEnded || look.lead === 'spinner' || look.hasCountdown ? null : voiceLook;
	const tone = voice ? voiceToneColors(theme, voice.tone) : toneColors(theme, look.tone);
	const title = voice ? voice.stripTitle : look.title;
	const sub = voice ? voice.stripSub : look.sub;
	const isPulsing = voice ? false : look.isPulsing;
	const announcedSeconds = look.hasCountdown ? announcedSecondsOf(secondsLeft) : null;
	const announcement =
		announcedSeconds === null ? null : t('liveReturnDroppedSub', { time: formatCountdown(announcedSeconds) });

	useEffect(() => {
		if (announcement !== null) {
			AccessibilityInfo.announceForAccessibility(announcement);
		}
	}, [announcement]);

	const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
		if (event.nativeEvent.actionName === 'activate') {
			(look.isEnded ? onDismiss : onReturn)();
		}
	};

	const isStacked = fontScale >= STACKED_FONT_SCALE;

	const lead = (
		<View style={styles.leadBox}>
			{/* The live ripple round the disc, as on the reader's Birlikte button: 40pt to 56pt in a 66pt strip. */}
			{isPulsing ? <Ripple color={tone.accent} maxScale={1.4} size={LEAD_SIZE} /> : null}
			<View style={[styles.lead, { backgroundColor: tone.lead }]}>
				{look.lead === 'spinner' ? (
					<Spinner color={tone.accent} />
				) : voice?.stripGlyph && state.role === 'leader' ? (
					<Icon color={tone.accent} name={voice.stripGlyph} size={22} strokeWidth={1.6} />
				) : look.lead === 'initials' ? (
					<Typography color={tone.accent} style={styles.initials} weight='semibold'>
						{look.initials}
					</Typography>
				) : (
					<Icon
						color={tone.accent}
						name={look.isEnded ? 'liveSession' : 'liveSessionTinted'}
						size={22}
						strokeWidth={1.8}
					/>
				)}
			</View>
			{look.hasCountdown ? (
				<ProgressRing
					color={tone.accent}
					isTicking
					percent={(secondsLeft / LIVE_GRACE_SECONDS) * 100}
					size={RING_SIZE}
					strokeWidth={RING_STROKE}
					style={styles.ring}
					trackColor={toAlphaColor(tone.accent, 0.22)}
				/>
			) : null}
			{voice?.badge ? (
				<LiveVoiceBadge
					badge={voice.badge}
					color={tone.accent}
					ink={tone.lead}
					isReader={state.role === 'leader'}
					ringColor={tone.background}
				/>
			) : null}
		</View>
	);

	const copy = (
		<View style={styles.copy}>
			<Typography color={tone.title} style={styles.title} weight='semibold'>
				{title}
			</Typography>
			<Typography color={tone.sub} style={styles.sub}>
				{sub}
			</Typography>
		</View>
	);

	/*
	 * Voice's own button ("Sesi kapat", "Dinle", "Durdur") stands beside the strip's tap rather
	 * than inside it — it does something else than going back, so a screen reader reaches it on
	 * its own ("Ayşe Yılmaz sesli okuyor. Dinle, düğme."). The notice has none, and no "Okumaya dön".
	 */
	const voiceButton = voice?.button ?? null;

	/*
	 * **One button, always mounted, in one place** — a native glass button made on the spot draws
	 * its first frame unplaced. Voice's own action when voice speaks; otherwise "Okumaya dön", or
	 * "Tamam" once the session has ended. Voice with nothing to offer lifts it out of the row.
	 */
	const buttonProps = voice
		? voiceButton
			? {
					...(voiceButton.icon === undefined ? {} : { icon: voiceButton.icon }),
					onPress: () => onVoiceAction(voiceButton.action),
					title: voiceButton.label,
					variant: voiceButton.isPrimary ? ('primary' as const) : ('surface' as const)
			  }
			: null
		: look.isEnded
		? { onPress: onDismiss, title: t('liveTeachOk'), variant: 'surface' as const }
		: {
				icon: 'chevronRight' as const,
				iconPosition: 'trailing' as const,
				onPress: onReturn,
				title: t('liveReturnGo'),
				variant: 'primary' as const
		  };

	return (
		<Animated.View
			onLayout={event => onHeightChange(event.nativeEvent.layout.height)}
			style={{
				...styles.strip,
				backgroundColor: tone.background,
				borderColor: tone.border,
				bottom,
				boxShadow: `0 10px 28px ${theme.colors.liveStripShadow}, 0 1px 3px ${theme.colors.liveStripShadowNear}`,
				transitionDuration: STATE_TRANSITION_MS,
				transitionProperty: ['backgroundColor', 'borderColor'],
				...(shouldRise && !isReducedMotion
					? {
							animationDuration: RISE_MS,
							animationName: {
								from: { opacity: 0, transform: [{ translateY: RISE_DISTANCE }] },
								to: { opacity: 1, transform: [{ translateY: 0 }] }
							},
							animationTimingFunction: 'ease-out'
					  }
					: {})
			}}
		>
			<View style={[styles.voiceLayout, isStacked ? styles.stacked : styles.row]}>
				{voice ? (
					<Pressable
						accessibilityHint={t('liveReturnHint')}
						accessibilityLabel={`${title}, ${sub}`}
						accessibilityRole='button'
						onPress={onReturn}
						style={[styles.row, styles.voicePress]}
					>
						{lead}
						{copy}
					</Pressable>
				) : (
					<Pressable
						accessibilityActions={[{ name: 'activate' }]}
						accessibilityHint={look.isEnded ? t('liveReturnDismissHint') : t('liveReturnHint')}
						accessibilityLabel={`${look.title}, ${announcement !== null ? announcement : look.sub}`}
						accessibilityRole='button'
						accessible
						onAccessibilityAction={handleAccessibilityAction}
						// Ended, a tap on the strip does nothing; only "Tamam" puts it away.
						{...(look.isEnded ? {} : { onPress: onReturn })}
						style={[styles.row, styles.voicePress]}
					>
						{lead}
						{copy}
					</Pressable>
				)}
				{/* Outside voice the strip is the one element for a screen reader, and this its action. */}
				<View
					accessibilityElementsHidden={!voice || !buttonProps}
					importantForAccessibility={voice && buttonProps ? 'auto' : 'no-hide-descendants'}
					pointerEvents={buttonProps ? 'auto' : 'none'}
					style={buttonProps ? (isStacked ? null : styles.buttonBox) : styles.buttonHidden}
				>
					<AppButton
						fullWidth={isStacked}
						onPress={buttonProps?.onPress ?? onReturn}
						size='md'
						title={buttonProps?.title ?? t('liveReturnGo')}
						variant={buttonProps?.variant ?? 'primary'}
						{...(buttonProps && 'icon' in buttonProps && buttonProps.icon !== undefined
							? { icon: buttonProps.icon }
							: {})}
						{...(buttonProps && 'iconPosition' in buttonProps
							? { iconPosition: buttonProps.iconPosition }
							: {})}
					/>
				</View>
			</View>
		</Animated.View>
	);
};

/* The design's measures (Birlikte Oku Dönüş, "Ölçü"). */
const styles = StyleSheet.create({
	buttonBox: {
		flexShrink: 0
	},
	// Kept mounted while there is nothing to offer — out of the row, unseen and untouchable.
	buttonHidden: {
		opacity: 0,
		position: 'absolute'
	},
	copy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	initials: {
		fontSize: 13,
		lineHeight: 17
	},
	lead: {
		alignItems: 'center',
		borderRadius: LEAD_SIZE / 2,
		height: LEAD_SIZE,
		justifyContent: 'center',
		width: LEAD_SIZE
	},
	leadBox: {
		flexShrink: 0,
		height: LEAD_SIZE,
		width: LEAD_SIZE
	},
	ring: {
		left: (LEAD_SIZE - RING_SIZE) / 2,
		position: 'absolute',
		top: (LEAD_SIZE - RING_SIZE) / 2
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	spinner: {
		borderRadius: 8,
		borderWidth: 2,
		height: 16,
		width: 16
	},
	stacked: {
		gap: 12
	},
	strip: {
		borderRadius: 18,
		borderWidth: 1,
		justifyContent: 'center',
		left: 10,
		minHeight: 66,
		position: 'absolute',
		right: 10
	},
	sub: {
		fontSize: 12.5,
		fontVariant: ['tabular-nums'],
		lineHeight: 17
	},
	title: {
		fontSize: 14,
		lineHeight: 18
	},
	// The padding the press has in the plain strip: here on the row that holds the press and the button.
	voiceLayout: {
		paddingBottom: 10,
		paddingLeft: 12,
		paddingRight: 10,
		paddingTop: 10
	},
	voicePress: {
		flex: 1,
		minWidth: 0
	}
});
