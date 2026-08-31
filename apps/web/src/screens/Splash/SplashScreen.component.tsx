import { ShelfMark } from '@/components/ShelfMark/ShelfMark.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	FadeInDown,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

/** The design's near-black, which is darker than the app's own dark background. */
const DARK_BACKDROP = '#0C0D0C';
const SLIVER_WIDTH = 64;
const SLIVER_MS = 1350;
/** The wordmark rises just before the mark's last column lands. */
const WORDMARK_DELAY_MS = 460;

/**
 * A0 · Açılış.
 *
 * Full-bleed brand green — near-black in dark — with the mark growing column by column, the
 * wordmark rising under it, and a sliver looping along the bottom.
 *
 * The sliver is deliberately indeterminate: it travels rather than fills. Nothing here knows
 * how much of the boot is left, and a bar that crept to 90% and stopped would be a claim the
 * app can't make.
 */
export const SplashScreen = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const isDark = theme.mode === 'dark';

	const backdrop = isDark ? DARK_BACKDROP : theme.colors.accent;
	const ink = '#FFFFFF';
	const travel = useSharedValue(0);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		travel.value = withRepeat(
			withTiming(1, { duration: SLIVER_MS, easing: Easing.bezier(0.6, 0.05, 0.4, 0.95) }),
			-1,
			false
		);
	}, [isReducedMotion, travel]);

	// -100% to 280% of the track: the sliver enters, crosses and leaves.
	const sliverStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: -SLIVER_WIDTH + travel.value * SLIVER_WIDTH * 3.8 }]
	}));

	return (
		<View style={[styles.root, { backgroundColor: backdrop }]}>
			<View style={styles.centre}>
				<ShelfMark color={ink} dimColor={toAlphaColor(ink, 0.34)} />

				<Animated.View
					entering={isReducedMotion ? undefined : FadeInDown.delay(WORDMARK_DELAY_MS).duration(600)}
					style={styles.wordmark}
				>
					<Typography color={ink} style={styles.name} variant='display'>
						Cüzhane
					</Typography>
					<Typography color={toAlphaColor(ink, 0.62)} style={styles.tagline}>
						{t('splashTagline')}
					</Typography>
				</Animated.View>
			</View>

			<View style={styles.sliverRow}>
				<View style={[styles.sliverTrack, { backgroundColor: toAlphaColor(ink, 0.34) }]}>
					<Animated.View style={[styles.sliver, { backgroundColor: ink }, sliverStyle]} />
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	centre: {
		alignItems: 'center',
		flex: 1,
		gap: 26,
		justifyContent: 'center'
	},
	name: {
		fontSize: 38,
		letterSpacing: -0.57,
		lineHeight: 38
	},
	root: {
		...StyleSheet.absoluteFill,
		// Above the dev trigger, which sits at 9999: while the splash is up it is the only
		// thing that should be on screen.
		zIndex: 10_000
	},
	sliver: {
		borderRadius: 2,
		height: '100%',
		width: '34%'
	},
	sliverRow: {
		alignItems: 'center',
		bottom: 44,
		left: 0,
		position: 'absolute',
		right: 0
	},
	sliverTrack: {
		borderRadius: 2,
		height: 2,
		overflow: 'hidden',
		width: SLIVER_WIDTH
	},
	tagline: {
		fontSize: 10.5,
		letterSpacing: 2.1,
		marginTop: 11,
		textTransform: 'uppercase'
	},
	wordmark: {
		alignItems: 'center'
	}
});
