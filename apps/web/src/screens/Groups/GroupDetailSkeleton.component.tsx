import { MyProgressCardSkeleton } from '@/components/MyProgressCard/MyProgressCardSkeleton.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';

/** `skCells` — a partial lattice, not the hundred: the pool card shows what is left. */
const POOL_CELL_COUNT = 15;
const POOL_COLUMNS = 10;

/**
 * D15 · Grup yükleniyor — üye görünümü.
 *
 * The assigned panel keeps its sage fill and tints its own bones out of the accent, exactly
 * as the frame does. That band is the one piece of colour on the screen, and a grey
 * placeholder there would have the page appear to change colour when the data lands rather
 * than simply fill in.
 */
export const GroupDetailSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;

	return (
		<View>
			{/*
			 * Title, its cadence chip, and the caption — which is all `ScreenHeader` draws here.
			 * There used to be an eyebrow bone above (the real header reserves no eyebrow row:
			 * `ScreenHeader` passes `hasReservedSecondaryLabel={false}`) and a 44pt square beside
			 * the title standing in for the corner action, which is a toolbar item in the
			 * navigator's bar now. Both made the bones a taller, wider block than the screen that
			 * replaced them, so the page shifted as it arrived.
			 */}
			<View style={styles.header}>
				<View style={styles.headerRow}>
					<Bone height={20} radius={9} width={168} />
					<Bone height={20} radius={6} tone='soft' width={62} />
				</View>
				<Bone height={9} radius={4.5} style={styles.headerCaption} tone='soft' width={132} />
			</View>

			<CardSurface isFlush style={styles.statsCard}>
				<View style={styles.statsRow}>
					<View style={[styles.statCell, { borderRightColor: divider, borderRightWidth: 1 }]}>
						<Bone height={17} radius={7} width={46} />
						<Bone height={7} radius={3.5} tone='soft' width={56} />
					</View>
					<View style={styles.statCell}>
						<Bone height={17} radius={7} width={38} />
						<Bone height={7} radius={3.5} tone='soft' width={44} />
					</View>
				</View>
				<View style={[styles.resetRow, { borderTopColor: divider }]}>
					<Bone height={15} radius={7.5} width={15} />
					<Bone height={9} radius={4.5} tone='soft' width={96} />
					<Bone height={8} radius={4} style={styles.resetTrailing} tone='soft' width={78} />
				</View>
			</CardSurface>

			<MyProgressCardSkeleton />

			{/* Matches the real panel's closed state, which keeps its sage fill rather than glass. */}
			<CardSurface
				hasGlassSurface={false}
				isFlush
				style={[styles.assignedPanel, { backgroundColor: theme.colors.accentSoft }]}
			>
				<View style={styles.assignedLeading}>
					<View
						style={[styles.assignedBadge, { backgroundColor: toAlphaColor(theme.colors.accent, 0.22) }]}
					/>
					<View style={[styles.assignedChip, { backgroundColor: toAlphaColor(theme.colors.accent, 0.14) }]} />
				</View>
				<View style={styles.assignedCopy}>
					<View
						style={[styles.assignedLineTop, { backgroundColor: toAlphaColor(theme.colors.accent, 0.18) }]}
					/>
					<View
						style={[
							styles.assignedLineBottom,
							{ backgroundColor: toAlphaColor(theme.colors.accent, 0.13) }
						]}
					/>
				</View>
				<View style={[styles.assignedMeta, { backgroundColor: toAlphaColor(theme.colors.accent, 0.18) }]} />
			</CardSurface>

			<CardSurface style={styles.lastRoundCard}>
				<Bone height={40} radius={13} width={40} />
				<View style={styles.lastRoundCopy}>
					<Bone height={9} radius={4.5} width='58%' />
					<Bone height={8} radius={4} tone='soft' width='74%' />
				</View>
				<Bone height={14} radius={3} tone='soft' width={8} />
			</CardSurface>

			<CardSurface isFlush style={styles.poolCard}>
				<View style={[styles.poolHeader, { borderBottomColor: divider }]}>
					<Bone height={14} radius={6} width={62} />
					<Bone height={8} radius={4} tone='soft' width={70} />
				</View>
				<View style={styles.poolBody}>
					<View style={styles.poolGrid}>
						{Array.from({ length: POOL_CELL_COUNT }, (_, index) => (
							<View key={index} style={styles.poolSlot}>
								<Bone height={undefined} radius={4} style={styles.poolCell} />
							</View>
						))}
						{/* Keeps the short last row's cells the width of a full one. */}
						{Array.from(
							{ length: (POOL_COLUMNS - (POOL_CELL_COUNT % POOL_COLUMNS)) % POOL_COLUMNS },
							(_, index) => (
								<View key={`spacer-${index}`} style={styles.poolSlot} />
							)
						)}
					</View>
				</View>
			</CardSurface>

			<SkeletonStatusRow label={t('loadingGroup')} />
		</View>
	);
};

const styles = StyleSheet.create({
	assignedBadge: {
		borderRadius: 12,
		height: 38,
		width: 38
	},
	assignedChip: {
		borderRadius: 6,
		height: 16,
		width: 22
	},
	assignedCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	assignedLeading: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 5
	},
	assignedLineBottom: {
		borderRadius: 4.5,
		height: 9,
		width: '78%'
	},
	assignedLineTop: {
		borderRadius: 3.5,
		height: 7,
		width: '52%'
	},
	assignedMeta: {
		borderRadius: 4.5,
		height: 9,
		width: 32
	},
	assignedPanel: {
		alignItems: 'center',
		borderColor: 'transparent',
		flexDirection: 'row',
		gap: 13,
		marginTop: 12,
		marginBottom: 12,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	/*
	 * Clear of the navigator's back button, exactly as `ScreenHeader` is on the screen this
	 * stands in for. Without it the skeleton's own title bone sat under the floating control
	 * — and a stand-in that starts in a different place than the real thing defeats the point
	 * of having one.
	 */
	header: {
		paddingBottom: 16,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	headerCaption: {
		marginTop: 9
	},
	headerRow: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between'
	},
	lastRoundCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		marginBottom: 12,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	lastRoundCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	poolBody: {
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	poolCard: {
		marginBottom: 12
	},
	poolCell: {
		aspectRatio: 1,
		width: '100%'
	},
	poolGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap'
	},
	poolHeader: {
		alignItems: 'center',
		borderBottomWidth: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 13,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	// Percentage slots with the gap as padding inside them — ten cells at `10%` plus a row
	// `gap` overflow and wrap a column early, which is the bug `GridSkeleton` documents.
	poolSlot: {
		flexDirection: 'row',
		padding: 1.5,
		width: `${100 / POOL_COLUMNS}%`
	},
	resetRow: {
		alignItems: 'center',
		borderTopWidth: 1,
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	resetTrailing: {
		marginLeft: 'auto'
	},
	statCell: {
		flex: 1,
		gap: 8,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	statsCard: {
		marginBottom: 12
	},
	statsRow: {
		flexDirection: 'row'
	}
});
