import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { RoundsSkeleton } from './RoundsSkeleton.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { RoundCard } from '@/components/RoundCard/RoundCard.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { CaptionText, NumericText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetRounds } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupCycle, RoundSummary } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'Rounds'>;

/** One array for the empty case, so the list's memo isn't invalidated by a new `[]`. */
const NO_ROUNDS: RoundSummary[] = [];

const BAB_TOTAL = 100;

/**
 * 10. Every pass the group has made at the hundred, newest first.
 *
 * The open round leads in an accent-bordered card because it is the only one still
 * changing; the closed ones below carry what they finished with. A round that fell short
 * keeps its shortfall on the chip rather than hiding it — that number is the reason this
 * screen exists, and it stays reachable through the detail view.
 */
export const RoundsScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const groupQuery = useGetGroupById(groupId);
	const roundsQuery = useGetRounds(groupId);

	/*
	 * Derived **above the guards below**, because the list's callbacks are hooks and hooks
	 * cannot sit after an early return. The fallbacks only ever apply on the paths that
	 * return a skeleton or an error, where none of this is read.
	 */
	const cycle: GroupCycle = groupQuery.data?.cycle ?? 'DAILY';
	const rounds = roundsQuery.data ?? NO_ROUNDS;
	const openRound = rounds.find(round => round.isOpen);
	const pastRounds = useMemo(() => rounds.filter(round => !round.isOpen), [rounds]);

	// The design labels rounds by cadence rather than by date: a daily group's previous
	// round is "dün", a weekly one's is "geçen hafta".
	const whenLabel = useCallback(
		(round: RoundSummary, isOpenRound: boolean) => {
			if (isOpenRound) {
				return cycle === 'DAILY' ? t('todayLabel') : t('thisWeekLabel');
			}

			const isPrevious = openRound !== undefined && round.roundIndex === openRound.roundIndex - 1;

			if (!isPrevious) {
				// Anything older than one round back is dated — "4 turdan önce" would make the
				// reader count backwards.
				return new Date(round.startedAt).toLocaleDateString(undefined, {
					day: 'numeric',
					month: 'short'
				});
			}

			return cycle === 'DAILY' ? t('yesterdayLabel') : t('lastWeekLabel');
		},
		[cycle, openRound, t]
	);

	const keyExtractor = useCallback((round: RoundSummary) => String(round.roundIndex), []);

	const renderRound = useCallback(
		({ item }: { item: RoundSummary }) => (
			<RoundCard
				isComplete={item.missedCount === 0}
				label={`${t('roundN')} ${item.roundIndex + 1}`}
				missedLabel={item.missedCount === 0 ? t('roundComplete') : `${item.missedCount} ${t('missedN')}`}
				onPress={() => navigation.navigate('RoundDetail', { groupId, roundIndex: item.roundIndex })}
				percent={Math.round((item.readCount / BAB_TOTAL) * 100)}
				readLabel={`${item.readCount}/${BAB_TOTAL}`}
				whenText={whenLabel(item, false)}
			/>
		),
		[groupId, navigation, t, whenLabel]
	);

	if (groupQuery.isPending || roundsQuery.isPending) {
		return (
			<ScreenContainer>
				<RoundsSkeleton />
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || roundsQuery.isError || !groupQuery.data || !roundsQuery.data) {
		return (
			<ScreenContainer isScrollable={false}>
				<View style={styles.centered}>
					<EmptyState
						actionLabel={t('retry')}
						onAction={() => {
							groupQuery.refetch();
							roundsQuery.refetch();
						}}
						title={t('genericError')}
					/>
				</View>
			</ScreenContainer>
		);
	}

	const header = (
		<>
			<ScreenHeader
				onBack={navigation.goBack}
				subtitle={t('roundsSub')}
				title={t('rounds')}
				titleTrailing={<Chip label={t(cycle === 'DAILY' ? 'daily' : 'weekly')} tone='accent' />}
			/>
			{openRound ? (
				<CardSurface style={[styles.openCard, { borderColor: theme.colors.accent }]}>
					<View style={styles.openHeader}>
						<View style={styles.openHeading}>
							<TitleText>{`${t('roundN')} ${openRound.roundIndex + 1}`}</TitleText>
							<CaptionText color={theme.colors.subtext} style={styles.openWhen}>
								{`${whenLabel(openRound, true)} · ${t('thisRound')}`}
							</CaptionText>
						</View>
						<Chip label={t('roundOpen')} tone='accent' />
					</View>
					<View style={styles.openCounts}>
						<NumericText color={theme.colors.accent}>{openRound.readCount}</NumericText>
						<CaptionText color={theme.colors.faintText}>{`/ ${BAB_TOTAL} ${t('babs')}`}</CaptionText>
						<CaptionText color={theme.colors.faintText} style={styles.openMine}>
							{`${openRound.myReadCount}/${openRound.myOwedCount} ${t('yourShare')}`}
						</CaptionText>
					</View>
					<ProgressBar percent={Math.round((openRound.readCount / BAB_TOTAL) * 100)} />
				</CardSurface>
			) : null}
		</>
	);

	return (
		/*
		 * A **windowed list**, not a mapped `ScrollView`. Rounds are append-only — a daily
		 * group running a year holds 365 of them — and every card carries a chip, a date and
		 * an animated `ProgressBar`, so mapping them all mounted the entire history at once
		 * and kept it mounted. The header travels as `ListHeaderComponent` so it scrolls with
		 * the list rather than pinning a second scroll view above it.
		 */
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<FlatList
				contentContainerStyle={styles.listContent}
				data={pastRounds}
				initialNumToRender={8}
				keyExtractor={keyExtractor}
				ListHeaderComponent={header}
				maxToRenderPerBatch={8}
				removeClippedSubviews
				renderItem={renderRound}
				showsVerticalScrollIndicator={false}
				windowSize={7}
			/>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	centered: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	openCard: {
		borderWidth: 1,
		marginBottom: 12,
		padding: 16
	},
	openCounts: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 7,
		marginBottom: 9
	},
	openHeader: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 12
	},
	openHeading: {
		flex: 1
	},
	openMine: {
		marginLeft: 'auto'
	},
	openWhen: {
		marginTop: 3
	},
	pastBar: {
		flex: 1
	},
	pastCard: {
		padding: 15
	},
	pastHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 10
	},
	pastHeading: {
		flex: 1
	},
	// The list carries the screen's padding now, so the container hands it a flush surface
	// to scroll inside — padding on the container would clip the scroll edges.
	// Horizontal and bottom padding move to the list so its scroll runs edge to edge; the
	// container keeps `paddingTop`, which is carrying the status-bar inset — zeroing that too
	// drew the header straight over the clock.
	flush: {
		paddingBottom: 0,
		paddingHorizontal: 0
	},
	listContent: {
		gap: 9,
		paddingBottom: 24,
		paddingHorizontal: 20,
		paddingTop: 8
	},
	pastProgress: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	pastWhen: {
		marginTop: 2
	}
});
