import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressRing } from '@/components/ui/ProgressRing/ProgressRing.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor, type AppTheme } from '@/lib/theme/tokens';
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
import { announcedSecondsOf, describeLiveStrip, type LiveStripTone } from './liveReturnStrip';
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
 * The session whose strip has already risen into view. The strip remounts with every tab
 * (each tab carries its own), and only its **first** appearance rises — a tab switch is not one.
 */
let risenForCode: string | null = null;

type ToneColors = {
	background: string;
	border: string;
	title: string;
	sub: string;
	lead: string;
	accent: string;
};

/** The design's TONES, by token — see `liveStrip*` in `tokens.ts`. */
const toneColors = (theme: AppTheme, tone: LiveStripTone): ToneColors => {
	const { colors } = theme;

	switch (tone) {
		case 'live':
			return {
				accent: colors.liveStripAccent,
				background: colors.liveStrip,
				border: colors.liveStripBorder,
				lead: colors.liveStripLead,
				sub: colors.liveStripSub,
				title: colors.text
			};
		case 'warn':
			return {
				accent: colors.liveStripWarnAccent,
				background: colors.liveStripWarn,
				border: colors.liveStripWarnBorder,
				lead: colors.liveStripWarnLead,
				sub: colors.liveStripWarnSub,
				title: colors.liveStripWarnTitle
			};
		case 'calm':
		case 'done':
			return {
				accent: tone === 'calm' ? colors.liveStripQuietAccent : toAlphaColor(colors.text, 0.45),
				background: colors.liveStripQuiet,
				border: toAlphaColor(colors.text, 0.12),
				lead: colors.liveStripQuietLead,
				sub: colors.liveStripQuietSub,
				title: colors.text
			};
	}
};

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
	const tone = toneColors(theme, look.tone);
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
			{look.isPulsing ? <Ripple color={tone.accent} maxScale={1.4} size={LEAD_SIZE} /> : null}
			<View style={[styles.lead, { backgroundColor: tone.lead }]}>
				{look.lead === 'spinner' ? (
					<Spinner color={tone.accent} />
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
		</View>
	);

	const copy = (
		<View style={styles.copy}>
			<Typography color={tone.title} style={styles.title} weight='semibold'>
				{look.title}
			</Typography>
			<Typography color={tone.sub} style={styles.sub}>
				{look.sub}
			</Typography>
		</View>
	);

	// Hidden from the screen reader: the strip is the one element, and its action is the button's.
	const button = (
		<View
			accessibilityElementsHidden
			importantForAccessibility='no-hide-descendants'
			style={isStacked ? null : styles.buttonBox}
		>
			<AppButton
				fullWidth={isStacked}
				onPress={look.isEnded ? onDismiss : onReturn}
				size='md'
				title={look.isEnded ? t('liveTeachOk') : t('liveReturnGo')}
				variant={look.isEnded ? 'surface' : 'primary'}
				{...(look.isEnded ? {} : { icon: 'chevronRight' as const, iconPosition: 'trailing' as const })}
			/>
		</View>
	);

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
			<Pressable
				accessibilityActions={[{ name: 'activate' }]}
				accessibilityHint={look.isEnded ? t('liveReturnDismissHint') : t('liveReturnHint')}
				accessibilityLabel={`${look.title}, ${announcement !== null ? announcement : look.sub}`}
				accessibilityRole='button'
				accessible
				onAccessibilityAction={handleAccessibilityAction}
				// Ended, a tap on the strip does nothing; only "Tamam" puts it away.
				{...(look.isEnded ? {} : { onPress: onReturn })}
				style={[styles.press, isStacked ? styles.stacked : styles.row]}
			>
				{isStacked ? (
					<>
						<View style={styles.row}>
							{lead}
							{copy}
						</View>
						{button}
					</>
				) : (
					<>
						{lead}
						{copy}
						{button}
					</>
				)}
			</Pressable>
		</Animated.View>
	);
};

/* The design's measures (Birlikte Oku Dönüş, "Ölçü"). */
const styles = StyleSheet.create({
	buttonBox: {
		flexShrink: 0
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
	// The padding is the press's, so the whole strip is the target.
	press: {
		paddingBottom: 10,
		paddingLeft: 12,
		paddingRight: 10,
		paddingTop: 10
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
	}
});
