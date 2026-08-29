import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { CaptionText, NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated';

const SPINNER_SIZE = 64;
/** `skCells10` — one row of the block draining back into the pool. */
const CELL_COUNT = 10;
const DOT_MS = 600;

/**
 * H1 · Havuza bırakılıyor.
 *
 * The range sits *inside* the spinner, in mono — that is the design's "1–5 spinner", and it
 * is what makes the sheet say which block is leaving when several are claimed at once.
 *
 * The sub-line names the consequence rather than the mechanism ("everyone sees it the moment
 * it lands"), so it deliberately doesn't repeat the range.
 */
export const ReleasingSlotOverlay = ({ range }: { range: string }) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const dot = useSharedValue(1);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		dot.value = withRepeat(
			withSequence(withTiming(0.3, { duration: DOT_MS }), withTiming(1, { duration: DOT_MS })),
			-1,
			false
		);
	}, [dot, isReducedMotion]);

	const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));

	return (
		<View style={styles.root}>
			<View style={[StyleSheet.absoluteFill, { backgroundColor: toAlphaColor(theme.colors.text, 0.34) }]} />

			<View style={[styles.sheet, { backgroundColor: theme.colors.sheet }]}>
				<View style={[styles.grabber, { backgroundColor: toAlphaColor(theme.colors.text, 0.16) }]} />

				<View style={styles.spinnerRow}>
					<View style={styles.spinnerWrap}>
						<SkeletonSpinner size={SPINNER_SIZE} thickness={3} />
						{/*
						 * Wider than the ring and single-line: a thirteen-bab range like "27–39"
						 * is five characters and wrapped inside the 64pt circle, breaking after
						 * the dash. It reads clearly overhanging the ring; it does not read at
						 * all stacked.
						 */}
						<View pointerEvents='none' style={styles.spinnerLabel}>
							<NumericText color={theme.colors.accent} numberOfLines={1}>
								{range}
							</NumericText>
						</View>
					</View>
				</View>

				<Typography style={styles.title} variant='title'>
					{t('releasingTitle')}
				</Typography>
				<CaptionText color={theme.colors.subtext} style={styles.subtitle}>
					{t('releasingSub')}
				</CaptionText>

				{/* The block itself, draining. */}
				<View style={styles.grid}>
					{Array.from({ length: CELL_COUNT }, (_, index) => (
						<View key={index} style={styles.cellSlot}>
							<Bone height={undefined} radius={4} style={styles.cell} />
						</View>
					))}
				</View>

				<View style={styles.statusRow}>
					<Animated.View style={[styles.dot, { backgroundColor: theme.colors.accent }, dotStyle]} />
					<CaptionText color={theme.colors.faintText}>{t('releasingStatus')}</CaptionText>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	cell: {
		aspectRatio: 1,
		width: '100%'
	},
	// Percentage slots with the gap as padding inside them — ten cells at `10%` plus a row
	// `gap` overflow and wrap a column early.
	cellSlot: {
		flexDirection: 'row',
		padding: 1.5,
		width: `${100 / CELL_COUNT}%`
	},
	dot: {
		borderRadius: 3,
		height: 6,
		width: 6
	},
	grabber: {
		alignSelf: 'center',
		borderRadius: 2,
		height: 4,
		marginBottom: 20,
		width: 38
	},
	grid: {
		flexDirection: 'row',
		marginBottom: 18
	},
	root: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'flex-end'
	},
	sheet: {
		borderTopLeftRadius: 26,
		borderTopRightRadius: 26,
		paddingBottom: 26,
		paddingHorizontal: 20,
		paddingTop: 10
	},
	spinnerLabel: {
		alignItems: 'center',
		bottom: 0,
		justifyContent: 'center',
		// Overhangs the ring by 20pt a side so a five-character range stays on one line.
		left: -20,
		position: 'absolute',
		right: -20,
		top: 0
	},
	spinnerRow: {
		alignItems: 'center',
		marginBottom: 18
	},
	spinnerWrap: {
		height: SPINNER_SIZE,
		width: SPINNER_SIZE
	},
	statusRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center'
	},
	subtitle: {
		alignSelf: 'center',
		marginBottom: 20,
		marginTop: 9,
		maxWidth: 250,
		textAlign: 'center'
	},
	title: {
		textAlign: 'center'
	}
});
