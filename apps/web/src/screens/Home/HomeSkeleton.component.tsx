import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Enough rows to fill the fold without promising how many groups there are. */
const ROW_COUNT = 3;
const DAY_COUNT = 7;
const SHEET_RADIUS = 32;
const DAY_SIZE = 27;
const AVATAR_SIZE = 36;
/** The status ring, and the turn it makes. */
const RING_SIZE = 13;
const RING_WIDTH = 1.8;
const RING_TURN_MS = 800;

/**
 * The one thing on this screen that is not a bone: a ring that actually turns, telling the
 * reader the app is working rather than stuck. It is a drawn ring rather than
 * `ActivityIndicator` because the whole screen is the app's own drawing — a platform spinner
 * in the middle of it reads as a different app's furniture.
 */
const StatusRing = () => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const turn = useSharedValue(0);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		turn.value = withRepeat(withTiming(360, { duration: RING_TURN_MS, easing: Easing.linear }), -1, false);
	}, [isReducedMotion, turn]);

	const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

	return (
		<Animated.View
			style={[styles.ring, { borderColor: theme.colors.border, borderTopColor: theme.colors.accent }, spinStyle]}
		/>
	);
};

/**
 * **B8L — H1 while it waits.** The coloured layer with its greeting and free-reading row, then
 * the paper sheet with the streak card, the groups heading and a few rows: the same furniture
 * the real screen puts in the same places, so nothing jumps when the data lands.
 *
 * The top layer is drawn for real rather than boned — it is a flat colour either way, and a
 * grey block where the sage belongs would flash a different screen for half a second. Only the
 * text on it is stubbed, in the layer's own ink at low opacity rather than the skeleton tone,
 * which is mixed for paper.
 *
 * **One pulse for the whole screen, not one per bone.** The design gives every placeholder its
 * own animation with a stagger — seven in the week strip, three more down the rows. That is
 * twenty-odd Reanimated mappers on the screen that is on display precisely while the app is
 * busy, and it is the same mistake that once made the bab board unscrollable (CLAUDE.md).
 * `SkeletonPulse` breathes the subtree as one. The stagger is what is lost; the screen still
 * reads as alive, and it costs a single mapper.
 *
 * The status line at the bottom is outside that wrapper on purpose: it is real text about a
 * real state, and a label that faded in and out with the bones would read as another
 * placeholder.
 */
export const HomeSkeleton = () => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const onHeader = toAlphaColor(theme.colors.onHeaderSurface, 0.16);

	return (
		<View style={[styles.root, { backgroundColor: theme.colors.headerSurface }]}>
			<SkeletonPulse style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
				<View style={styles.headerRow}>
					<View style={styles.greeting}>
						<View style={[styles.bar, { backgroundColor: onHeader, height: 11, width: 84 }]} />
						<View style={[styles.bar, { backgroundColor: onHeader, height: 20, width: 176 }]} />
					</View>
					<View style={[styles.avatar, { backgroundColor: onHeader }]} />
				</View>
				<View style={[styles.freeRead, { borderColor: onHeader }]}>
					<View style={[styles.freeReadBadge, { backgroundColor: onHeader }]} />
					<View style={styles.freeReadCopy}>
						<View style={[styles.bar, { backgroundColor: onHeader, height: 11, width: 96 }]} />
						<View style={[styles.bar, { backgroundColor: onHeader, height: 9, width: 168 }]} />
					</View>
				</View>
			</SkeletonPulse>

			<View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
				<SkeletonPulse style={styles.content}>
					<CardSurface style={styles.streak}>
						<View style={styles.streakHead}>
							<View style={styles.streakCopy}>
								<Bone height={8} radius={4} tone='soft' width={78} />
								<Bone height={20} radius={7} width={104} />
							</View>
							<Bone height={8} radius={4} tone='soft' width={54} />
						</View>
						<View style={[styles.week, { borderTopColor: theme.colors.border }]}>
							{Array.from({ length: DAY_COUNT }, (_, index) => (
								<View key={index} style={styles.day}>
									<Bone height={7} radius={3.5} tone='soft' width={18} />
									<Bone height={DAY_SIZE} radius={DAY_SIZE / 2} width={DAY_SIZE} />
								</View>
							))}
						</View>
					</CardSurface>

					<View style={styles.groupsHead}>
						<View style={styles.groupsCopy}>
							<Bone height={10} radius={5} width={72} />
							<Bone height={8} radius={4} tone='soft' width={96} />
						</View>
						<Bone height={24} radius={12} width={24} />
					</View>

					{Array.from({ length: ROW_COUNT }, (_, index) => (
						<CardSurface key={index} style={styles.row}>
							<View style={styles.rowBody}>
								<View style={styles.rowTitle}>
									<Bone height={11} radius={5} width={44} />
									<Bone height={9} radius={4.5} style={styles.rowName} />
								</View>
								<Bone height={6} radius={3} width='100%' />
							</View>
							<Bone height={32} radius={10} width={58} />
						</CardSurface>
					))}
				</SkeletonPulse>

				{/* The screen's own name rather than "Loading…": it says *what* is coming, and it
				    is the word the tab bar already uses for it. */}
				<View style={styles.status}>
					<StatusRing />
					<Typography color={theme.colors.faintText} style={styles.statusLabel}>
						{t('home')}
					</Typography>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	avatar: {
		borderRadius: AVATAR_SIZE / 2,
		height: AVATAR_SIZE,
		width: AVATAR_SIZE
	},
	bar: {
		borderRadius: 5
	},
	content: {
		gap: 11,
		paddingHorizontal: 17,
		paddingTop: 16
	},
	day: {
		alignItems: 'center',
		flex: 1,
		gap: 7
	},
	freeRead: {
		alignItems: 'center',
		borderRadius: 15,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 11,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	freeReadBadge: {
		borderRadius: 9,
		height: 30,
		width: 30
	},
	freeReadCopy: {
		flex: 1,
		gap: 5
	},
	greeting: {
		flex: 1,
		gap: 6
	},
	groupsCopy: {
		flex: 1,
		gap: 5
	},
	groupsHead: {
		alignItems: 'flex-end',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 3,
		paddingTop: 6
	},
	header: {
		gap: 18,
		paddingBottom: 20,
		paddingHorizontal: 20
	},
	headerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	ring: {
		borderRadius: RING_SIZE / 2,
		borderWidth: RING_WIDTH,
		height: RING_SIZE,
		width: RING_SIZE
	},
	root: {
		flex: 1
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	rowBody: {
		flex: 1,
		gap: 9
	},
	rowName: {
		flex: 1
	},
	rowTitle: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	sheet: {
		borderTopLeftRadius: SHEET_RADIUS,
		borderTopRightRadius: SHEET_RADIUS,
		flex: 1,
		overflow: 'hidden'
	},
	status: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center',
		paddingBottom: 2,
		paddingTop: 16
	},
	statusLabel: {
		fontSize: 10.5,
		lineHeight: 14
	},
	streak: {
		paddingBottom: 4,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	streakCopy: {
		gap: 8
	},
	streakHead: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	},
	week: {
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 5,
		marginTop: 14,
		paddingVertical: 12
	}
});
