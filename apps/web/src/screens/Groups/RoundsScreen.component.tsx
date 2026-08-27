import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { CaptionText, MonoText, NumericText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetRounds } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupCycle, RoundSummary } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'Rounds'>;

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

	if (groupQuery.isPending || roundsQuery.isPending) {
		return (
			<ScreenContainer isScrollable={false}>
				<View style={styles.centered}>
					<ActivityIndicator color={theme.colors.accent} />
				</View>
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

	const cycle: GroupCycle = groupQuery.data.cycle;
	const rounds = roundsQuery.data;
	const openRound = rounds.find(round => round.isOpen);
	const pastRounds = rounds.filter(round => !round.isOpen);

	// The design labels rounds by cadence rather than by date: a daily group's previous
	// round is "dün", a weekly one's is "geçen hafta".
	const whenLabel = (round: RoundSummary, isOpenRound: boolean) => {
		if (isOpenRound) {
			return cycle === 'DAILY' ? t('todayLabel') : t('thisWeekLabel');
		}

		const isPrevious = openRound !== undefined && round.roundIndex === openRound.roundIndex - 1;

		if (!isPrevious) {
			// Anything older than one round back is dated — "4 turdan önce" would make the
			// reader count backwards.
			return new Date(round.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
		}

		return cycle === 'DAILY' ? t('yesterdayLabel') : t('lastWeekLabel');
	};

	return (
		<ScreenContainer>
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

			<View style={styles.pastList}>
				{pastRounds.map(round => {
					const isComplete = round.missedCount === 0;

					return (
						<CardSurface
							key={round.roundIndex}
							onPress={() =>
								navigation.navigate('RoundDetail', { groupId, roundIndex: round.roundIndex })
							}
							style={styles.pastCard}
						>
							<View style={styles.pastHeader}>
								<View style={styles.pastHeading}>
									<CaptionText weight='semibold'>{`${t('roundN')} ${
										round.roundIndex + 1
									}`}</CaptionText>
									<CaptionText color={theme.colors.subtext} style={styles.pastWhen}>
										{whenLabel(round, false)}
									</CaptionText>
								</View>
								<Chip
									label={isComplete ? t('roundComplete') : `${round.missedCount} ${t('missedN')}`}
									tone={isComplete ? 'accent' : 'missed'}
								/>
							</View>
							<View style={styles.pastProgress}>
								<ProgressBar
									percent={Math.round((round.readCount / BAB_TOTAL) * 100)}
									style={styles.pastBar}
									// A short round fills in clay so the bar and its chip agree.
									{...(isComplete ? {} : { fillColor: theme.colors.missed })}
								/>
								<MonoText color={theme.colors.faintText}>{`${round.readCount}/${BAB_TOTAL}`}</MonoText>
							</View>
						</CardSurface>
					);
				})}
			</View>
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
	pastList: {
		gap: 9
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
