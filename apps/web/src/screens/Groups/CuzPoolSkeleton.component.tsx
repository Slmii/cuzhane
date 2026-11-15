import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { CUZ_COUNT } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';

/** The compact map's ten across — `CuzMap`'s `compact` geometry. */
const MAP_COLUMNS = 10;
/** Its 3pt gap, carried as padding inside each slot — see `poolSlot` below. */
const MAP_GAP = 3;
/** Three rows: the havuz is rarely longer, and a short guess shifts less than a long one. */
const ROW_COUNT = 3;
/** The row's 44pt badge. */
const BADGE_SIZE = 44;
/** A `sm` button's height, and roughly "Üstlen"'s width at that size. */
const BUTTON_HEIGHT = 36;
const BUTTON_WIDTH = 92;

/**
 * Q3l · Cüz havuzu yükleniyor — below the screen's own header, which is known before the
 * data and stays drawn.
 *
 * **Our Q3, not the frame's.** The frame draws a list of plain rows in one card; the screen
 * has since become a count-and-map card over a row per cüz, each its own card with the badge,
 * the holder's line and Üstlen beside it. The bones follow that: the thirty at the compact
 * map's geometry, its three-entry key, then separate row cards — so what lands fills in rather
 * than rearranges.
 */
export const CuzPoolSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<>
			{/* The screen's own 12 between sections, which a single pulse wrapper would otherwise swallow. */}
			<SkeletonPulse style={styles.stack}>
				<CardSurface style={styles.summaryCard}>
					{/* Count and word, on the real row's lines: numeric 28, caption 17. */}
					<View style={styles.summaryRow}>
						<Bone height={20} radius={7} style={styles.count} width={26} />
						<Bone height={9} radius={4.5} tone='soft' width={78} />
					</View>
					<View style={styles.map}>
						{Array.from({ length: CUZ_COUNT }, (_, index) => (
							<View key={index} style={styles.poolSlot}>
								{/* A plain view, not a `Bone`: its default height would override `aspectRatio`. */}
								<View style={[styles.cell, { backgroundColor: theme.colors.secondary }]} />
							</View>
						))}
					</View>
					<View style={styles.legend}>
						{[46, 38, 34].map(width => (
							<View key={width} style={styles.legendEntry}>
								<Bone height={11} radius={4} width={11} />
								<Bone height={8} radius={4} tone='soft' width={width} />
							</View>
						))}
					</View>
				</CardSurface>

				<View style={styles.list}>
					{Array.from({ length: ROW_COUNT }, (_, index) => (
						<CardSurface key={index} style={styles.row}>
							<Bone height={BADGE_SIZE} radius={13} width={BADGE_SIZE} />
							<View style={styles.rowCopy}>
								<Bone height={11} radius={5} style={styles.rowTitle} width='52%' />
								<Bone height={8} radius={4} style={styles.rowSub} tone='soft' width='84%' />
							</View>
							<Bone height={BUTTON_HEIGHT} radius={11} width={BUTTON_WIDTH} />
						</CardSurface>
					))}
				</View>
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingPoolCuz')} />
		</>
	);
};

const styles = StyleSheet.create({
	cell: {
		aspectRatio: 1,
		borderRadius: 4,
		width: '100%'
	},
	count: {
		// Centred in `NumericText`'s 28pt line.
		marginVertical: 4
	},
	legend: {
		flexDirection: 'row',
		gap: 14,
		marginTop: 12
	},
	legendEntry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	list: {
		gap: 9
	},
	// Pulled out by half a gap so the slots' inner padding lands the outer cells on the card's edge.
	map: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		margin: -MAP_GAP / 2
	},
	// Percentage slots with the gap as padding inside them — ten cells at `10%` plus a row `gap`
	// overflow and wrap a column early, which is the bug `GridSkeleton` documents.
	poolSlot: {
		flexDirection: 'row',
		padding: MAP_GAP / 2,
		width: `${100 / MAP_COLUMNS}%`
	},
	// The real row's metrics — `CuzPoolScreen`'s `cuzCard`.
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	rowCopy: {
		flex: 1,
		minWidth: 0
	},
	// Centred in `BodyStrongText`'s 18pt line, then the caption's 17 under a 2pt gap.
	rowSub: {
		marginBottom: 4.5,
		marginTop: 6.5
	},
	rowTitle: {
		marginVertical: 3.5
	},
	stack: {
		gap: 12
	},
	summaryCard: {
		marginBottom: 12,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	summaryRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		marginBottom: 12
	}
});
