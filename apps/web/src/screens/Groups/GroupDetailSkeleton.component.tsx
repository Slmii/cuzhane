import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { MyProgressCardSkeleton } from '@/components/MyProgressCard/MyProgressCardSkeleton.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { unitCountFor } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';

/** `BabLegend`'s five keys for a Cevşen board — the same count the screen's own stand-in uses. */
const BAB_LEGEND_COUNT = 5;

/**
 * D15 · Grup yükleniyor — üye görünümü.
 *
 * What the group screen draws for a Cevşen group, in its order: the heading with its cadence
 * and kind chips, the countdown card, "Senin ilerlemen", the sage "Sana atanan" strip, one row
 * where "Geçen tur" and "Havuz" sit, then the hundred. The pool used to be a lattice card here;
 * the screen has since made it a row and moved the board to the Havuz screen, and the hundred —
 * which the skeleton left out — is `GridSkeleton` itself, the very stand-in the screen shows
 * while the board loads, so nothing changes shape between the two moments.
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
		<View style={styles.root}>
			<SkeletonPulse style={styles.stack}>
				{/*
				 * Title, its cadence and kind chips, and the caption — which is all `ScreenHeader`
				 * draws here. No eyebrow row (`hasReservedSecondaryLabel={false}`) and no square for
				 * the corner action, which is a toolbar item in the navigator's bar: either made the
				 * bones a taller, wider block than the screen that replaced them.
				 */}
				<View style={styles.header}>
					<View style={styles.headerRow}>
						<Bone height={22} radius={9} width={150} />
						<Bone height={20} radius={6} tone='soft' width={52} />
						<Bone height={20} radius={6} tone='soft' width={58} />
					</View>
					<Bone height={9} radius={4.5} style={styles.headerCaption} tone='soft' width={132} />
				</View>

				{/* Members and the countdown, then the reset line under a hairline. */}
				<CardSurface isFlush>
					<View style={styles.statsRow}>
						<View
							style={[
								styles.statCell,
								{ borderRightColor: divider, borderRightWidth: StyleSheet.hairlineWidth }
							]}
						>
							<Bone height={20} radius={7} width={52} />
							<Bone height={8} radius={4} tone='soft' width={56} />
						</View>
						<View style={styles.statCell}>
							<Bone height={20} radius={7} width={44} />
							<Bone height={8} radius={4} tone='soft' width={44} />
						</View>
					</View>
					<View style={[styles.resetRow, { borderTopColor: divider }]}>
						<Bone height={15} radius={7.5} width={15} />
						<Bone height={9} radius={4.5} tone='soft' width={96} />
						<Bone height={8} radius={4} style={styles.resetTrailing} tone='soft' width={78} />
					</View>
				</CardSurface>

				<MyProgressCardSkeleton />

				{/*
				 * "Sana atanan", closed: the slice badge with its count chip beside it, one line of
				 * label — the sentence that once sat under it is gone on the screen too — and the done
				 * count with its chevron.
				 */}
				<CardSurface
					hasGlassSurface={false}
					isFlush
					style={[
						styles.assignedPanel,
						{ backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.transparent }
					]}
				>
					<View style={styles.assignedLeading}>
						<View
							style={[styles.assignedBadge, { backgroundColor: toAlphaColor(theme.colors.accent, 0.22) }]}
						/>
						<View
							style={[styles.assignedChip, { backgroundColor: toAlphaColor(theme.colors.accent, 0.14) }]}
						/>
					</View>
					<View style={styles.assignedCopy}>
						<View
							style={[styles.assignedLabel, { backgroundColor: toAlphaColor(theme.colors.accent, 0.18) }]}
						/>
					</View>
					<View style={[styles.assignedMeta, { backgroundColor: toAlphaColor(theme.colors.accent, 0.18) }]} />
				</CardSurface>

				{/* The row shape "Geçen tur" and "Havuz" share: a tile, two lines, a chevron. */}
				<CardSurface style={styles.rowCard}>
					<Bone height={40} radius={13} width={40} />
					<View style={styles.rowCopy}>
						<Bone height={9} radius={4.5} width='58%' />
						<Bone height={8} radius={4} tone='soft' width='74%' />
					</View>
					<Bone height={14} radius={3} tone='soft' width={8} />
				</CardSurface>
			</SkeletonPulse>

			<GridSkeleton cellCount={unitCountFor('CEVSEN')} legendCount={BAB_LEGEND_COUNT} />

			<SkeletonStatusRow label={t('loadingGroup')} />
		</View>
	);
};

const styles = StyleSheet.create({
	// A slice such as "1–13" — wider than the real badge's 38pt minimum, which only "1–5" fits.
	assignedBadge: {
		borderRadius: 12,
		height: 38,
		width: 48
	},
	assignedChip: {
		borderRadius: 6,
		height: 16,
		width: 22
	},
	assignedCopy: {
		flex: 1,
		minWidth: 0
	},
	assignedLabel: {
		borderRadius: 3.5,
		height: 7,
		width: '52%'
	},
	assignedLeading: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 5
	},
	assignedMeta: {
		borderRadius: 4.5,
		height: 9,
		width: 56
	},
	assignedPanel: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	/*
	 * Clear of the navigator's back button, exactly as `ScreenHeader` is on the screen this
	 * stands in for, and its 18 of air underneath — with the column's 12 below that, the
	 * countdown card starts where the real one will.
	 */
	header: {
		paddingBottom: 18,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	headerCaption: {
		marginTop: 9
	},
	headerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9
	},
	resetRow: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	resetTrailing: {
		marginLeft: 'auto'
	},
	/** `ScreenContainer` spaces a column by 12; one child here, so the skeleton restores it. */
	root: {
		gap: 12
	},
	rowCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	rowCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	stack: {
		gap: 12
	},
	// Taller than the bones inside it: the real cell holds a 28pt numeral over a 14pt label.
	statCell: {
		flex: 1,
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 16
	},
	statsRow: {
		flexDirection: 'row'
	}
});
