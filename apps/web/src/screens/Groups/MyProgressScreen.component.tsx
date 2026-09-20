import { PeriodStrip } from '@/components/PeriodStrip/PeriodStrip.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { StatTile } from '@/components/ui/StatTile/StatTile.component';
import { CaptionText, TitleText, Typography } from '@/components/ui/Typography/Typography.component';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useGetMyProgress } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { MyProgressPeriod } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'MyProgress'>;

/** The four swatches under the strip, in the design's order. */
const LEGEND = ['mpLegendFull', 'mpLegendPart', 'mpLegendNone', 'mpLegendOpen'] as const;

/**
 * F7 — "Senin ilerlemen": one member's own record, and the babs they can still go back for.
 *
 * **There is no Günlük/Haftalık control**, though the design's frame draws one. In the
 * prototype that toggle is read by a single line and written by nothing else, while the
 * create-group cycle picker drives daily/weekly copy in ten other places: it let the
 * designer preview both layouts on one frame. A real group has exactly one cycle, so the
 * other tab has no data behind it — on a WEEKLY group no single day owes anything, and
 * every daily cell would be invented. The strip follows `group.cycle` instead.
 */
export const MyProgressScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();

	const groupQuery = useGetGroupById(groupId);
	const progressQuery = useGetMyProgress(groupId);
	const pullToRefresh = usePullToRefresh(groupQuery, progressQuery);

	const progress = progressQuery.data;

	/*
	 * Grouped above the guards, because `useMemo` is a hook and cannot sit after an early
	 * return. Only the closed periods carry missed babs, so this is already the whole list.
	 */
	const missedPeriods = useMemo(
		() => (progress?.periods ?? []).filter(period => period.missedBabs.length > 0).reverse(),
		[progress]
	);

	if (groupQuery.isPending || progressQuery.isPending) {
		// The heading is known before the data is, so it stays put rather than the screen
		// arriving blank and growing a title a moment later.
		return (
			<ScreenContainer>
				<ScreenHeader hasBackButton subtitle={t('mpSub')} title={t('myProgress')} />
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || progressQuery.isError || !groupQuery.data || !progress) {
		return <ErrorState queries={[groupQuery, progressQuery]} />;
	}

	const group = groupQuery.data;
	const isWeekly = progress.cycle === 'WEEKLY';
	const openPeriod = progress.periods.at(-1);

	/**
	 * The day itself, beside the relative label.
	 *
	 * "5 gün önce" says how far back without saying *when*, and which day it was is the thing
	 * a reader actually remembers about one they missed. In the **group's** zone, since which
	 * day a round belongs to is the group's question rather than the device's — and without a
	 * weekday, unlike the reader's, because this line already carries two other facts.
	 */
	const dateLabel = (period: MyProgressPeriod) =>
		new Intl.DateTimeFormat(language, {
			day: 'numeric',
			month: 'long',
			timeZone: group.timezone
		}).format(new Date(period.startedAt));

	// "3 gün önce" / "3 hafta önce" — how far back a closed round sits, counted in the
	// group's own periods rather than in calendar days, because a round *is* the period.
	const agoLabel = (period: MyProgressPeriod) => {
		const distance = (openPeriod?.roundIndex ?? period.roundIndex) - period.roundIndex;

		return t(isWeekly ? 'mpWeeksAgo' : 'mpDaysAgo', { n: distance });
	};

	const legendTone = {
		mpLegendFull: theme.colors.accent,
		mpLegendNone: theme.colors.missed,
		mpLegendOpen: theme.colors.surface,
		mpLegendPart: theme.colors.accentMid
	};

	return (
		<ScreenContainer isScrollable pullToRefresh={pullToRefresh}>
			<ScreenHeader hasBackButton subtitle={t('mpSub')} title={t('myProgress')} />

			<View style={styles.stats}>
				<StatTile
					label={t('mpRead')}
					style={styles.statTile}
					tone='accent'
					value={`${progress.readCount}/${progress.owedCount}`}
				/>
				<StatTile label={t('mpMissed')} style={styles.statTile} value={progress.missedCount} />
				<StatTile label={t('mpRate')} style={styles.statTile} value={`${progress.ratePercent}%`} />
			</View>

			<View style={styles.sectionHead}>
				<TitleText>{isWeekly ? t('mpLast8') : t('mpLast7')}</TitleText>
				{openPeriod ? (
					<CaptionText color={theme.colors.subtext}>
						{`${t('myBabs')} ${openPeriod.readCount}/${openPeriod.owedCount}`}
					</CaptionText>
				) : null}
			</View>

			<CardSurface style={styles.stripCard}>
				<PeriodStrip cycle={progress.cycle} periods={progress.periods} timezone={group.timezone} />
			</CardSurface>

			<View style={styles.legend}>
				{LEGEND.map(key => (
					<View key={key} style={styles.legendItem}>
						<View
							style={[
								styles.swatch,
								{
									backgroundColor: legendTone[key],
									// Only the "open" swatch is an outline — it is the one state
									// drawn as a ring rather than a fill on the strip itself.
									borderColor: key === 'mpLegendOpen' ? theme.colors.accent : legendTone[key]
								}
							]}
						/>
						<CaptionText color={theme.colors.subtext}>
							{key === 'mpLegendOpen'
								? `${t(key)} (${isWeekly ? t('mpThisWeek') : t('mpToday')})`
								: t(key)}
						</CaptionText>
					</View>
				))}
			</View>

			<View style={styles.sectionHead}>
				<TitleText>{t('mpMissedList')}</TitleText>
				{progress.missedCount > 0 ? <Chip label={String(progress.missedCount)} tone='missed' /> : null}
			</View>

			{missedPeriods.length > 0 ? (
				<CardSurface isFlush>
					{missedPeriods.map(period => {
						// One action for the row, so it opens where the catching-up starts.
						const firstMissed = period.missedBabs[0];
						const isWholeShare = period.missedBabs.length === period.owedCount;

						return (
							<View
								key={period.roundIndex}
								style={[styles.missedRow, { borderBottomColor: theme.colors.divider }]}
							>
								<View style={styles.missedCopy}>
									<View style={styles.missedHead}>
										<CaptionText weight='semibold'>{dateLabel(period)}</CaptionText>
										<CaptionText color={theme.colors.subtext}>
											{`· ${agoLabel(period)} · ${t('mpBabCount', {
												n: period.missedBabs.length
											})}${isWholeShare ? ` · ${t('mpAllMissed')}` : ''}`}
										</CaptionText>
									</View>
									{/*
									 * **Only the gaps.** The design draws the whole share and greys
									 * out what was read; that was built and dropped on sight — the
									 * grey squares were the majority on a good day, so the thing
									 * the screen is about was the quieter half of its own list.
									 */}
									<View style={styles.squares}>
										{period.missedBabs.map(missed => (
											<View
												key={missed.babNumber}
												style={[styles.square, { backgroundColor: theme.colors.missedSurface }]}
											>
												<Typography
													color={theme.colors.missed}
													style={styles.squareLabel}
													weight='semibold'
												>
													{missed.babNumber}
												</Typography>
											</View>
										))}
									</View>
								</View>
								{/*
								 * **One "Oku" for the row**, not a pill per bab. It opens the oldest
								 * gap in that round and the reader walks forward from there — a
								 * share is contiguous, so stepping the run is the arrows' job once
								 * you are in it.
								 */}
								{firstMissed ? (
									<AppButton
										/*
										 * **`fullWidth={false}`, or the button is a sliver.** It
										 * defaults to true, which on iOS 26 tells the SwiftUI host
										 * to fill its column — and in this row the column is
										 * whatever the `flex: 1` copy beside it leaves over, which
										 * once the squares wrap is nothing. False makes the host
										 * measure horizontally and report its own width, which is
										 * what the other call sites in flex rows do.
										 */
										fullWidth={false}
										onPress={() =>
											navigation.navigate('BabReader', {
												babNumber: firstMissed.babNumber,
												groupId,
												// The round this gap belongs to — a weekly cell spans
												// seven, so the period's own index could aim the
												// cover at the wrong one.
												roundIndex: firstMissed.roundIndex
											})
										}
										size='sm'
										style={styles.readButton}
										title={t('read')}
										variant='accent'
									/>
								) : null}
							</View>
						);
					})}
				</CardSurface>
			) : (
				<CardSurface style={styles.empty}>
					<CaptionText color={theme.colors.subtext}>{t('mpNoMissed')}</CaptionText>
				</CardSurface>
			)}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	empty: {
		alignItems: 'center',
		padding: 18
	},
	legend: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 14
	},
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	missedCopy: {
		flex: 1,
		gap: 8,
		minWidth: 0
	},
	missedHead: {
		alignItems: 'baseline',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6
	},
	missedRow: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 14,
		paddingVertical: 13
	},
	square: {
		alignItems: 'center',
		borderRadius: 8,
		height: 30,
		justifyContent: 'center',
		width: 30
	},
	/*
	 * **`flexShrink: 0`** — the design's `flex:none` on the same element. The copy column
	 * beside it is `flex: 1`, so without this the button is whatever width is left over, and
	 * a share wide enough to wrap the squares onto a second line squeezed it to a sliver.
	 */
	readButton: {
		flexShrink: 0
	},
	squareLabel: {
		fontSize: 12,
		lineHeight: 15
	},
	squares: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 5
	},
	sectionHead: {
		alignItems: 'baseline',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	statTile: {
		flex: 1
	},
	swatch: {
		borderRadius: 3,
		borderWidth: 1.5,
		height: 9,
		width: 9
	},
	stats: {
		flexDirection: 'row',
		gap: 8
	},
	stripCard: {
		paddingHorizontal: 13,
		paddingVertical: 14
	}
});
