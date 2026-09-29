import { HizbCoverageGrid } from '@/components/HizbCoverageGrid/HizbCoverageGrid.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useHizbReading } from '@/lib/hooks/useHizbReading';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { planBoardCells } from '@/lib/utils/hizbPlanBoard';
import { spansFor } from '@/lib/utils/hizbPlans';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { HizbGroupProgressSkeleton } from './HizbGroupProgressSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbGroupProgress'>;

const PORTIONS = 33;

/**
 * T4 of "Hizb Kişisel Plan" — the group's day in full: today's 33 with the portions still unread
 * named (so readers know where to go), yesterday's gaps, and the last thirty days as bars, each
 * as tall as that day's coverage and dark when the day was whole.
 *
 * A day read later counts for its own day, never today's; the closing note says so in plain words,
 * with the viewer's own numbers when their newest missed day is yesterday.
 */
export const HizbGroupProgressScreen = ({ route }: Props) => {
	const { groupId } = route.params;
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const text = useHizbPlanText();
	const query = useHizbReading(groupId);
	const pullToRefresh = usePullToRefresh(query);
	const data = query.data?.pages[0];
	const cells = useMemo(() => (data ? planBoardCells(data.coveredSpans, data.today) : []), [data]);

	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}

	if (!data) {
		return <HizbGroupProgressSkeleton />;
	}

	const readCount = cells.filter(cell => cell.state === 'read').length;
	const unread = cells.filter(cell => cell.state !== 'read').map(cell => cell.number);
	const yesterdayUnread = data.previousDay
		? planBoardCells(data.previousDay.coveredSpans, null)
				.filter(cell => cell.state !== 'read')
				.map(cell => cell.number)
		: [];
	// Oldest first, ending on yesterday: today is the card above.
	const days = data.dailyHistory.slice(1).reverse();
	const fullDays = days.filter(day => day.complete).length;

	// "Dünkü okumanı şimdi yaparsan dün 29 yerine 30 bölüm okunmuş sayılır" — only when the viewer's
	// newest missed day is yesterday, and reading it would change yesterday's count.
	const newestMissed = data.missed[0];
	const example = (() => {
		if (!data.previousDay || newestMissed?.date !== data.previousDay.date) {
			return null;
		}

		const from = PORTIONS - yesterdayUnread.length;
		const to = planBoardCells(
			[...data.previousDay.coveredSpans, ...spansFor(newestMissed.planDays, newestMissed.portion)],
			null
		).filter(cell => cell.state === 'read').length;

		return to === from ? null : t('hpCatchupExample', { from, to });
	})();

	return (
		<ScreenContainer pullToRefresh={pullToRefresh}>
			<ScreenHeader hasBackButton title={t('hpGroupProgress')} />

			<View>
				<CardSurface style={styles.coverage}>
					<View style={styles.coverageHead}>
						<View>
							<Typography style={styles.bigNumber} variant='numeric'>
								{`${readCount} `}
								<Typography color={theme.colors.faintText} style={styles.bigTotal} variant='numeric'>
									{`/ ${PORTIONS}`}
								</Typography>
							</Typography>
							<Typography
								color={theme.colors.faintText}
								style={styles.statLabel}
								variant='stat'
								weight='medium'
							>
								{t('hpPortionsRead')}
							</Typography>
						</View>
						<CaptionText color={theme.colors.subtext} style={styles.percent} weight='semibold'>
							{t('hpPercent', { percent: Math.round((readCount * 100) / PORTIONS) })}
						</CaptionText>
					</View>
					<HizbCoverageGrid cells={cells} />
					{unread.length > 0 ? (
						<>
							<Typography
								color={theme.colors.faintText}
								style={styles.unreadLabel}
								variant='stat'
								weight='semibold'
							>
								{t('hpNotReadYet', { count: unread.length })}
							</Typography>
							<View style={styles.unreadChips}>
								{unread.map(number => (
									<View
										key={number}
										style={[styles.unreadChip, { backgroundColor: theme.colors.segmentTrack }]}
									>
										<CaptionText style={styles.unreadChipLabel} weight='semibold'>
											{number}
										</CaptionText>
									</View>
								))}
							</View>
						</>
					) : null}
				</CardSurface>

				{data.previousDay ? (
					// Yesterday in one sentence: how many of the 33 were read, then which were not.
					<CardSurface style={styles.yesterday}>
						<CaptionText style={styles.rowTitle} weight='semibold'>
							{t('hpYesterdayReadOf', { read: PORTIONS - yesterdayUnread.length })}
						</CaptionText>
						{yesterdayUnread.length > 0 ? (
							<CaptionText color={theme.colors.faintText} style={styles.rowSub}>
								{t('hpYesterdayUnreadList', { list: yesterdayUnread.join(', ') })}
							</CaptionText>
						) : null}
					</CardSurface>
				) : null}

				{days.length > 0 ? (
					<CardSurface style={styles.chart}>
						<View style={styles.chartHead}>
							<Typography style={styles.chartTitle} variant='title' weight='medium'>
								{t('hpLast30')}
							</Typography>
							<CaptionText color={theme.colors.accent} style={styles.small}>
								{t('hpFullDays', { count: fullDays })}
							</CaptionText>
						</View>
						{/* The chart's top is all 33, marked, so a short bar still reads as a part of it. */}
						<Typography
							color={theme.colors.faintText}
							style={styles.scaleLabel}
							variant='mono'
							weight='medium'
						>
							{String(PORTIONS)}
						</Typography>
						<View style={[styles.bars, { borderTopColor: theme.colors.divider }]}>
							{days.map(day => (
								<View
									accessibilityLabel={`${text.monthDay(day.date, 'short')} · ${t('hpPercent', {
										percent: Math.round((day.covered * 100) / day.total)
									})}`}
									key={day.date}
									style={[
										styles.bar,
										{
											backgroundColor: day.complete
												? theme.colors.accent
												: theme.colors.barPartial,
											height: `${Math.max(2, (day.covered * 100) / day.total)}%`
										}
									]}
								/>
							))}
						</View>
						<View style={styles.axis}>
							<Typography
								color={theme.colors.faintText}
								style={styles.axisLabel}
								variant='mono'
								weight='medium'
							>
								{days[0] ? text.monthDay(days[0].date, 'short') : ''}
							</Typography>
							<Typography
								color={theme.colors.faintText}
								style={styles.axisLabel}
								variant='mono'
								weight='medium'
							>
								{t('hpAxisYesterday')}
							</Typography>
						</View>
						<View style={styles.legend}>
							<View style={styles.legendKey}>
								<View style={[styles.swatch, { backgroundColor: theme.colors.accent }]} />
								<CaptionText color={theme.colors.faintText} style={styles.legendLabel}>
									{t('hpLegendFull')}
								</CaptionText>
							</View>
							<View style={styles.legendKey}>
								<View style={[styles.swatch, { backgroundColor: theme.colors.barPartial }]} />
								<CaptionText color={theme.colors.faintText} style={styles.legendLabel}>
									{t('hpLegendPartial')}
								</CaptionText>
							</View>
						</View>
						<View style={[styles.note, { borderTopColor: theme.colors.divider }]}>
							<CaptionText color={theme.colors.subtext} style={styles.noteText}>
								{example ?? t('hpCatchupGeneric')}
							</CaptionText>
						</View>
					</CardSurface>
				) : null}
			</View>
		</ScreenContainer>
	);
};

/* The design's measures, one to one (T4 of "Hizb Kişisel Plan"). */
const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	coverage: { marginBottom: 10, paddingHorizontal: 16, paddingVertical: 15 },
	coverageHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	bigNumber: { fontSize: 26, lineHeight: 26 },
	bigTotal: { fontSize: 17 },
	statLabel: { fontSize: 10, letterSpacing: 0.6, marginTop: 5 },
	percent: { fontSize: 11.5 },
	unreadLabel: { fontSize: 11, letterSpacing: 0.55, marginBottom: 8, marginTop: 14 },
	unreadChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
	unreadChip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
	unreadChipLabel: { fontSize: 11 },
	yesterday: { marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14 },
	rowTitle: { fontSize: 12.5 },
	rowSub: { fontSize: 11, lineHeight: 16, marginTop: 3 },
	chart: { paddingHorizontal: 16, paddingVertical: 15 },
	chartHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
	chartTitle: { fontSize: 15, lineHeight: 19 },
	small: { fontSize: 11 },
	scaleLabel: { fontSize: 10, marginBottom: 3, textAlign: 'right' },
	bars: {
		alignItems: 'flex-end',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 3,
		height: 84
	},
	bar: {
		borderBottomLeftRadius: 1,
		borderBottomRightRadius: 1,
		borderTopLeftRadius: 3,
		borderTopRightRadius: 3,
		flex: 1
	},
	axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
	axisLabel: { fontSize: 10 },
	legend: { flexDirection: 'row', gap: 14, marginTop: 12 },
	legendKey: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	swatch: { borderRadius: 3, height: 9, width: 9 },
	legendLabel: { fontSize: 10.5 },
	note: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
	noteText: { fontSize: 11.5, lineHeight: 17.8 }
});
