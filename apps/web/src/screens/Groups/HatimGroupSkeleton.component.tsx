import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { MyProgressCardSkeleton } from '@/components/MyProgressCard/MyProgressCardSkeleton.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { CUZ_COUNT } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';

/** `BabLegend`'s four keys for a hatim board — the same count the screen's own stand-in uses. */
const CUZ_LEGEND_COUNT = 4;

/**
 * Q2l · Hatim grubu yükleniyor — a Kur'an group before it arrives.
 *
 * **Our group screen, not the frame's.** A hatim opens on the same screen as a Cevşen group, so
 * this stands in for what that screen actually draws for one: the heading with its kind chip,
 * the countdown card, "Senin ilerlemen", the sage "Cüzlerin" strip, one row where "Geçen tur"
 * and "Havuz" sit, then the thirty. Where the frame differs from that, the screen wins:
 *
 * - **The thirty are ten across, not six.** The group board is `BabGrid` at its ten columns;
 *   six is the picker's map (QC4, the lobby), a different drawing.
 * - **The board is `GridSkeleton` itself** — the very stand-in the screen shows when the group
 *   has landed and the board has not — so nothing changes shape between the two moments.
 * - **The countdown card and the progress banner are in**, which the frame predates.
 * - **One chip beside the title, the kind's.** The cadence chip only exists for a repeating
 *   hatim, and a bone for it would be a promise a one-off never keeps.
 *
 * The sage strip keeps its colour and tints its bones from the accent, as `GroupDetailSkeleton`
 * does: it is the one band of colour on the page, and a grey one would read as a change of
 * colour when the data lands rather than the page filling in.
 */
export const HatimGroupSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;

	return (
		<View style={styles.root}>
			<SkeletonPulse style={styles.stack}>
				{/* Name, the kind chip on its line, and the dedication under it. */}
				<View style={styles.header}>
					<View style={styles.headerRow}>
						<Bone height={22} radius={9} width={168} />
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
				 * "Cüzlerin", closed. The badge is wider than the Cevşen's square because it holds
				 * the cüz themselves ("7 · 22"), and there is no slice chip beside it — a hatim's
				 * share is whole in the badge. One line of label, as on the screen: the sentence
				 * that once sat under it is gone there too.
				 */}
				<CardSurface
					hasGlassSurface={false}
					isFlush
					style={[
						styles.assignedPanel,
						{ backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.transparent }
					]}
				>
					<View
						style={[styles.assignedBadge, { backgroundColor: toAlphaColor(theme.colors.accent, 0.22) }]}
					/>
					<View style={styles.assignedCopy}>
						<View
							style={[styles.assignedLabel, { backgroundColor: toAlphaColor(theme.colors.accent, 0.18) }]}
						/>
					</View>
					<View style={[styles.assignedMeta, { backgroundColor: toAlphaColor(theme.colors.accent, 0.18) }]} />
				</CardSurface>

				{/* The row shape "Geçen tur", "Havuz" and "Hatim duası" all share: a tile, two lines, a chevron. */}
				<CardSurface style={styles.rowCard}>
					<Bone height={40} radius={13} width={40} />
					<View style={styles.rowCopy}>
						<Bone height={9} radius={4.5} width='58%' />
						<Bone height={8} radius={4} tone='soft' width='74%' />
					</View>
					<Bone height={14} radius={3} tone='soft' width={8} />
				</CardSurface>
			</SkeletonPulse>

			<GridSkeleton cellCount={CUZ_COUNT} legendCount={CUZ_LEGEND_COUNT} />

			<SkeletonStatusRow label={t('loadingHatim')} />
		</View>
	);
};

const styles = StyleSheet.create({
	assignedBadge: {
		borderRadius: 12,
		height: 38,
		width: 52
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
	 * Clear of the navigator's back button, as `ScreenHeader` is on the real screen, and its
	 * 18 of air underneath — with the column's 12 below that, the countdown card starts where
	 * the real one will.
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
		borderTopWidth: 1,
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
