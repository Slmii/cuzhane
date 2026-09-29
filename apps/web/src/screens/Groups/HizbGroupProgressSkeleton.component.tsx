import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** `HizbCoverageGrid`: the 33 in rows of 11, 4 apart. */
const COLUMNS = 11;
const PORTIONS = 33;
/** Unread chips: one row's worth — the count is the day's, so a middling day's. */
const UNREAD_CHIP_COUNT = 10;
/** Yesterday back through thirty days. */
const BAR_COUNT = 30;
/** Bar heights as a share of the 84pt track — a spread, so it reads as a chart. */
const BAR_HEIGHTS = [62, 80, 45, 100, 70, 88, 55, 100, 76, 40] as const;

/**
 * T4 · Grup ilerlemesi yükleniyor — `HizbGroupProgressScreen` before its data. The heading is
 * static, so it is the real one. Then its three cards at their own measures: today's count
 * over the 33 and the chips of what is still unread, yesterday's row, and the thirty bars with
 * their axis, legend and the closing note.
 *
 * Chosen where the screen depends on the data: yesterday's row is drawn (a group past its first
 * day has one), with its second line; ten unread chips (one row); the note at two lines.
 */
export const HizbGroupProgressSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;

	return (
		<ScreenContainer>
			<ScreenHeader hasBackButton title={t('hpGroupProgress')} />

			<SkeletonPulse>
				<CardSurface style={styles.coverage}>
					<View style={styles.coverageHead}>
						<View>
							{/* The 26pt count, then the stat label's 14 under 5. */}
							<Bone height={22} radius={7} style={styles.bigNumber} width={72} />
							<Bone height={7} radius={3.5} style={styles.statLabel} tone='soft' width={88} />
						</View>
						<Bone height={8} radius={4} style={styles.percent} tone='soft' width={34} />
					</View>
					<View style={styles.grid}>
						{Array.from({ length: PORTIONS / COLUMNS }, (_, row) => (
							<View key={row} style={styles.gridRow}>
								{Array.from({ length: COLUMNS }, (_, column) => (
									<View
										key={column}
										style={[styles.cell, { backgroundColor: theme.colors.segmentTrack }]}
									/>
								))}
							</View>
						))}
					</View>
					<Bone height={7} radius={3.5} style={styles.unreadLabel} tone='soft' width={104} />
					<View style={styles.unreadChips}>
						{Array.from({ length: UNREAD_CHIP_COUNT }, (_, index) => (
							<Bone height={27} key={index} radius={7} tone='soft' width={26} />
						))}
					</View>
				</CardSurface>

				<CardSurface style={styles.yesterday}>
					<Bone height={9} radius={4.5} style={styles.rowTitle} width='64%' />
					<Bone height={8} radius={4} style={styles.rowSub} tone='soft' width='42%' />
				</CardSurface>

				<CardSurface style={styles.chart}>
					<View style={styles.chartHead}>
						<Bone height={11} radius={5.5} style={styles.chartTitle} width={120} />
						<Bone height={8} radius={4} tone='soft' width={70} />
					</View>
					{/* The scale's "33", then the chart under its top line. */}
					<View style={styles.scaleLabel}>
						<Bone height={7} radius={3.5} tone='soft' width={14} />
					</View>
					<View style={[styles.bars, styles.barsTop, { borderTopColor: divider }]}>
						{Array.from({ length: BAR_COUNT }, (_, index) => (
							<View
								key={index}
								style={[
									styles.bar,
									{
										backgroundColor: theme.colors.segmentTrack,
										height: `${BAR_HEIGHTS[index % BAR_HEIGHTS.length] ?? 50}%`
									}
								]}
							/>
						))}
					</View>
					<View style={styles.axis}>
						<Bone height={7} radius={3.5} tone='soft' width={40} />
						<Bone height={7} radius={3.5} tone='soft' width={30} />
					</View>
					<View style={styles.legend}>
						{[56, 64].map(width => (
							<View key={width} style={styles.legendKey}>
								<Bone height={9} radius={3} width={9} />
								<Bone height={7} radius={3.5} tone='soft' width={width} />
							</View>
						))}
					</View>
					<View style={[styles.note, { borderTopColor: divider }]}>
						<Bone height={8} radius={4} style={styles.noteLine} tone='soft' width='96%' />
						<Bone height={8} radius={4} style={styles.noteLine} tone='soft' width='62%' />
					</View>
				</CardSurface>
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingGroup')} />
		</ScreenContainer>
	);
};

/* `HizbGroupProgressScreen`'s own measures, each bone centred in the line it stands in for. */
const styles = StyleSheet.create({
	coverage: { marginBottom: 10, paddingHorizontal: 16, paddingVertical: 15 },
	coverageHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	// 26pt line.
	bigNumber: { marginVertical: 2 },
	// 5 above a 14pt line.
	statLabel: { marginBottom: 3.5, marginTop: 8.5 },
	// The percent's 17pt line, sitting on the head's bottom edge.
	percent: { marginBottom: 4.5 },
	grid: { gap: 4 },
	gridRow: { flexDirection: 'row', gap: 4 },
	cell: { aspectRatio: 1, borderRadius: 6, flex: 1 },
	// 14 above a 14pt line and 8 below it.
	unreadLabel: { marginBottom: 11.5, marginTop: 17.5 },
	unreadChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
	yesterday: { marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14 },
	// 17pt line.
	rowTitle: { marginVertical: 4 },
	// 2 above a 17pt line.
	rowSub: { marginBottom: 4.5, marginTop: 6.5 },
	chart: { paddingHorizontal: 16, paddingVertical: 15 },
	chartHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
	// 19pt line.
	chartTitle: { marginVertical: 4 },
	// The scale's 13pt line and 3 below it, the bone at its right end.
	scaleLabel: { alignItems: 'flex-end', height: 13, justifyContent: 'center', marginBottom: 3 },
	bars: { alignItems: 'flex-end', flexDirection: 'row', gap: 3, height: 84 },
	barsTop: { borderTopWidth: StyleSheet.hairlineWidth },
	bar: {
		borderBottomLeftRadius: 1,
		borderBottomRightRadius: 1,
		borderTopLeftRadius: 3,
		borderTopRightRadius: 3,
		flex: 1
	},
	// 7 above the axis's 16pt line.
	axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11.5, marginBottom: 4.5 },
	// 12 above the legend's 17pt line.
	legend: { flexDirection: 'row', gap: 14, marginTop: 12, minHeight: 17 },
	legendKey: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	note: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
	// Two 17.8pt lines.
	noteLine: { marginVertical: 4.9 }
});
