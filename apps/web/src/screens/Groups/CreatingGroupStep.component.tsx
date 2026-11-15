import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyText, CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupKind } from '@/lib/types/domain';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { creatingCopy } from '@/lib/utils/groups';
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
 * C1 · Grup kuruluyor — what the create flow shows after its last step.
 *
 * It **replaces** the form inside the same sheet rather than covering it. As an overlay it
 * drew its own backdrop and grabber inside a sheet that already had both, so it read as a
 * second sheet stacked on the first — two grabbers, and a dim that stopped at the sheet's
 * edge instead of covering the page. The flow is already stepped (1/4 … 4/4); this is
 * simply what the sheet shows once there is nothing left to fill in.
 *
 * Creating a group writes the group, its parts and the owner's place in one transaction, which is long enough that a disabled button reads as a dropped tap.
 *
 * The steps are **illustrative, not reported** — the server does the whole thing in one
 * transaction and never tells the client which part it is on. They are ordered the way the
 * work happens so the sheet is honest about what is being waited for, but nothing here
 * should be read as progress. If the API ever does report stages, drive them from that
 * rather than adding timers.
 */
export const CreatingGroupStep = ({
	isFlexible = false,
	isPersonal = false,
	kind
}: {
	isFlexible?: boolean;
	/** A reading of your own (Şahsi, or an individual Hizb plan): nobody to invite, so no code. */
	isPersonal?: boolean;
	kind: GroupKind;
}) => {
	const { t } = useTranslation();
	// What the steps name follows what is being made: babs, cüz, or a plan's days.
	const copy = creatingCopy({ isFlexible, isPersonal, kind });
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
			<View>
				<Typography variant='title'>{t('creatingTitle')}</Typography>
				<CaptionText color={theme.colors.subtext} style={styles.subtitle}>
					{t(copy.sub)}
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
						<BodyText weight='medium'>{t(copy.step)}</BodyText>
					</View>

					{/* Not started: a dashed ring, so the row reads as pending rather than stalled. */}
					{copy.showsCode ? (
						<View style={styles.step}>
							<View
								style={[styles.stepDot, styles.stepDotPending, { borderColor: theme.colors.secondary }]}
							/>
							<BodyText color={theme.colors.faintText}>{t('creatingStepCode')}</BodyText>
						</View>
					) : null}
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
	root: {
		paddingBottom: 8,
		paddingTop: 4
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
