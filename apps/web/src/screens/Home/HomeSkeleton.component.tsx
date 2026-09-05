import { Bone } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Enough rows to fill the fold without promising how many groups there are. */
const ROW_COUNT = 3;
const DAY_COUNT = 7;
const SHEET_RADIUS = 32;
const DAY_SIZE = 27;
const AVATAR_SIZE = 36;

/**
 * H1 while it waits: the coloured layer with its greeting and free-reading row, then the
 * paper sheet with the streak card, the groups heading and a few rows.
 *
 * The top layer is drawn for real rather than boned — it is a flat colour either way, and a
 * grey block where the sage belongs would flash a different screen for half a second. Only the
 * text on it is stubbed, in the layer's own ink at low opacity rather than the skeleton tone,
 * which is mixed for paper.
 */
export const HomeSkeleton = () => {
	const { theme } = useThemeContext();
	const insets = useSafeAreaInsets();
	const onHeader = toAlphaColor(theme.colors.onHeaderSurface, 0.16);

	return (
		<View style={[styles.root, { backgroundColor: theme.colors.headerSurface }]}>
			<View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
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
			</View>

			<View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
				<View style={styles.content}>
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
