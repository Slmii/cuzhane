import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { BAB_COUNT } from '@/lib/utils/babs';
import { StyleSheet, View } from 'react-native';

const GRID_COLUMNS = 10;
/** The screen's own legend names five states. */
const LEGEND_WIDTHS = [44, 52, 38, 56, 46];
/** `skRows` — the "eksik üye" rows beneath the board. */
const MISSING_ROW_COUNT = 3;
/** The three stat tiles, with the design's own bone widths. */
const STATS = [
	{ label: 62, value: 34 },
	{ label: 56, value: 28 },
	{ label: 48, value: 34 }
];

/**
 * F4 · Tur detayı yükleniyor.
 *
 * The stat trio, the whole hundred, the legend and the rows naming who was short.
 *
 * The board is drawn here rather than delegated to `GridSkeleton`: this frame lays the
 * hundred out at a 6pt radius with a 4pt gap directly on the card, where the pool card's
 * lattice is smaller and carries a header. Sharing one component would have meant
 * parameterising it until it described neither.
 */
export const RoundDetailSkeleton = () => {
	const { t } = useTranslation();

	/*
	 * No header bones: the screen renders its real `ScreenHeader` above this one, because the
	 * round number is a route param rather than something the request supplies. The frame
	 * draws a stubbed heading only because a canvas has no route to read.
	 */
	return (
		<View>
			<View style={styles.statsRow}>
				{STATS.map(stat => (
					<CardSurface key={stat.label} style={styles.statCard}>
						<Bone height={19} radius={7} width={stat.value} />
						<Bone height={7} radius={3.5} tone='soft' width={stat.label} />
					</CardSurface>
				))}
			</View>

			<CardSurface style={styles.boardCard}>
				<View style={styles.grid}>
					{Array.from({ length: BAB_COUNT }, (_, index) => (
						<View key={index} style={styles.cellSlot}>
							<Bone height={undefined} radius={6} style={styles.cell} />
						</View>
					))}
				</View>
			</CardSurface>

			<View style={styles.legend}>
				{LEGEND_WIDTHS.map(width => (
					<View key={width} style={styles.legendItem}>
						<Bone height={9} radius={3} width={9} />
						<Bone height={7} radius={3.5} tone='soft' width={width} />
					</View>
				))}
			</View>

			<Bone height={8} radius={4} style={styles.rowsHeading} tone='soft' width={96} />

			<View style={styles.missingList}>
				{Array.from({ length: MISSING_ROW_COUNT }, (_, index) => (
					<CardSurface key={index} style={styles.missingCard}>
						<Bone height={38} radius={19} width={38} />
						<View style={styles.missingCopy}>
							<Bone height={9} radius={4.5} width='52%' />
							<Bone height={8} radius={4} tone='soft' width='74%' />
						</View>
						<Bone height={16} radius={5} width={22} />
						<Bone height={36} radius={11} tone='soft' width={36} />
					</CardSurface>
				))}
			</View>

			<SkeletonStatusRow label={t('loadingRound')} />
		</View>
	);
};

const styles = StyleSheet.create({
	boardCard: {
		marginBottom: 11,
		paddingHorizontal: 13,
		paddingVertical: 14
	},
	cell: {
		aspectRatio: 1,
		width: '100%'
	},
	// Percentage slots with the gap as padding inside them — ten cells at `10%` plus a row
	// `gap` overflow and wrap a column early, leaving the board a column short.
	cellSlot: {
		flexDirection: 'row',
		padding: 2,
		width: `${100 / GRID_COLUMNS}%`
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap'
	},
	legend: {
		columnGap: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: 20,
		rowGap: 8
	},
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	missingCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	missingCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	missingList: {
		gap: 9
	},
	rowsHeading: {
		marginBottom: 8
	},
	statCard: {
		flex: 1,
		gap: 9,
		paddingHorizontal: 14,
		paddingVertical: 13
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 14
	}
});
