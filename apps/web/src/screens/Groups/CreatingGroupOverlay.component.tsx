import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyText, CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

const FILL_MS = 2400;
const STEP_DOT = 22;

/**
 * C1 · Grup kuruluyor.
 *
 * Creating a group writes the group, its hundred babs and the owner's seat in one
 * transaction, which is long enough that a disabled button reads as a dropped tap. This
 * covers the form with the design's waiting sheet: a title, an indeterminate bar and a
 * three-step checklist.
 *
 * The steps are **illustrative, not reported** — the server does the whole thing in one
 * transaction and never tells the client which part it is on. They are ordered the way the
 * work happens so the sheet is honest about what is being waited for, but nothing here
 * should be read as progress. If the API ever does report stages, drive them from that
 * rather than adding timers.
 */
export const CreatingGroupOverlay = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const fill = useSharedValue(0);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		fill.value = withRepeat(withTiming(1, { duration: FILL_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) }), -1, false);
	}, [fill, isReducedMotion]);

	const fillStyle = useAnimatedStyle(() => ({ width: `${12 + fill.value * 76}%` }));

	return (
		<View style={styles.root}>
			<View style={[StyleSheet.absoluteFill, { backgroundColor: toAlphaColor(theme.colors.text, 0.34) }]} />

			<View style={[styles.sheet, { backgroundColor: theme.colors.sheet }]}>
				<View style={[styles.grabber, { backgroundColor: toAlphaColor(theme.colors.text, 0.16) }]} />

				<Typography variant='title'>{t('creatingTitle')}</Typography>
				<CaptionText color={theme.colors.subtext} style={styles.subtitle}>
					{t('creatingSub')}
				</CaptionText>

				<View style={[styles.track, { backgroundColor: theme.colors.secondary }]}>
					<Animated.View style={[styles.fill, { backgroundColor: theme.colors.accent }, fillStyle]} />
				</View>

				<View style={styles.steps}>
					{/* Done. */}
					<View style={styles.step}>
						<View style={[styles.stepDot, { backgroundColor: theme.colors.accentSoft }]}>
							<Icon color={theme.colors.accent} name='check' size={13} strokeWidth={2.6} />
						</View>
						<BodyText weight='medium'>{t('creatingStepGroup')}</BodyText>
					</View>

					{/* In flight — the same turning ring the loading screens use. */}
					<View style={styles.step}>
						<View style={styles.stepDot}>
							<SkeletonSpinner size={STEP_DOT} thickness={2} />
						</View>
						<BodyText weight='medium'>{t('creatingStepBabs')}</BodyText>
					</View>

					{/* Not started: a dashed ring, so the row reads as pending rather than stalled. */}
					<View style={styles.step}>
						<View
							style={[styles.stepDot, styles.stepDotPending, { borderColor: theme.colors.secondary }]}
						/>
						<BodyText color={theme.colors.faintText}>{t('creatingStepCode')}</BodyText>
					</View>
				</View>

				<CaptionText color={theme.colors.faintText} style={styles.wait}>
					{t('loadingWait')}
				</CaptionText>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	fill: {
		borderRadius: 2,
		height: '100%'
	},
	grabber: {
		alignSelf: 'center',
		borderRadius: 2,
		height: 4,
		marginBottom: 18,
		width: 38
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
	step: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 11
	},
	stepDot: {
		alignItems: 'center',
		borderRadius: STEP_DOT / 2,
		height: STEP_DOT,
		justifyContent: 'center',
		width: STEP_DOT
	},
	stepDotPending: {
		borderStyle: 'dashed',
		borderWidth: 2
	},
	steps: {
		gap: 13
	},
	subtitle: {
		marginBottom: 18,
		marginTop: 8
	},
	track: {
		borderRadius: 2,
		height: 4,
		marginBottom: 18,
		overflow: 'hidden'
	},
	wait: {
		marginTop: 20,
		textAlign: 'center'
	}
});
