import { useHintScreen } from '@/components/Hints/useHintScreen';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import type { HizbAssignment } from '@/api/hizbReading.api';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useHizbReading } from '@/lib/hooks/useHizbReading';
import { planReadingRoute } from '@/lib/utils/personalPlan';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { HizbMissedSkeleton } from './HizbMissedSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbMissed'>;

/**
 * T2 of "Hizb Kişisel Plan" — the reader's missed days, newest first, opened from the group
 * screen's "Senin ilerlemen" banner. Each card opens that day's own reading; read, it drops off
 * the list. Every missed day is here (the server sends them all), so it is a windowed list.
 */
export const HizbMissedScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	// One card that says what this page is for.
	useHintScreen('hizbMissed');
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	// The group's book, from the screen it was opened from — a Şahsi Cevşen or Kur'an reads here too.
	// Until the group is known, its book is too: Hizb labels on a Cevşen or Kur'an day would throw.
	const groupQuery = useGetGroupById(groupId);
	const groupKind = groupQuery.data?.kind;
	const kind = groupKind ?? 'HIZB';
	const text = useHizbPlanText(kind);
	const query = useHizbReading(groupId);
	const pullToRefresh = usePullToRefresh(query);
	const data = query.data?.pages[0];

	const open = useCallback(
		(assignmentId: string) => navigation.navigate(planReadingRoute(kind), { assignmentId, groupId }),
		[groupId, kind, navigation]
	);

	// Either failing is the screen's failure: the skeleton waits for both, and must not wait forever.
	if (query.isError || (groupQuery.isError && !groupKind)) {
		return <ErrorState queries={[query, groupQuery]} />;
	}

	if (!data || !groupKind) {
		return <HizbMissedSkeleton />;
	}

	const shortMonth = (date: string) =>
		new Date(`${date}T12:00:00Z`)
			.toLocaleDateString(language, { month: 'short', timeZone: 'UTC' })
			.replace('.', '')
			.toLocaleUpperCase(language);

	const renderDay = ({ item: reading }: { item: HizbAssignment }) => {
		const desc = text.portionDesc(reading);

		return (
			<CardSurface onPress={() => open(reading.id)} style={styles.row}>
				<View style={[styles.dateBadge, { backgroundColor: theme.colors.missedSurface }]}>
					<Typography color={theme.colors.missed} style={styles.dateDay} variant='title'>
						{Number(reading.date.slice(8, 10))}
					</Typography>
					<Typography color={theme.colors.missed} style={styles.dateMonth} variant='stat' weight='semibold'>
						{shortMonth(reading.date)}
					</Typography>
				</View>
				<View style={styles.copy}>
					<CaptionText style={styles.title} weight='semibold'>
						{text.isHizb
							? t('hpPortionWork', {
									portions: text.portionsLabel(reading),
									work: text.workTitle(reading)
							  })
							: `${text.partsLabel(reading)} · ${text.partsAside(reading)}`}
					</CaptionText>
					{desc ? (
						<CaptionText color={theme.colors.faintText} style={styles.desc}>
							{desc}
						</CaptionText>
					) : null}
				</View>
				<AppButton
					fullWidth={false}
					onPress={() => open(reading.id)}
					size='sm'
					title={t('hpReadAction')}
					variant='primary'
				/>
			</CardSurface>
		);
	};

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<PullToRefresh {...pullToRefresh}>
				<FlatList
					contentContainerStyle={styles.listContent}
					data={data.missed}
					initialNumToRender={10}
					keyExtractor={reading => reading.id}
					ListEmptyComponent={<EmptyState icon='check' title={t('hpMissedEmpty')} />}
					ListHeaderComponent={
						<ScreenHeader
							eyebrow={t('hpMyProgress')}
							hasBackButton
							subtitle={
								data.missedCount > 0 ? t('hpMissedSubtitle', { count: data.missedCount }) : undefined
							}
							title={t('hpMissedTitle')}
						/>
					}
					maxToRenderPerBatch={10}
					nestedScrollEnabled
					renderItem={renderDay}
					showsVerticalScrollIndicator={false}
					windowSize={9}
				/>
			</PullToRefresh>
		</ScreenContainer>
	);
};

/* The design's measures, one to one (T2 of "Hizb Kişisel Plan"). */
const styles = StyleSheet.create({
	flush: { paddingHorizontal: 0 },
	listContent: { gap: 9, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 8 },
	row: { alignItems: 'center', flexDirection: 'row', gap: 13, paddingHorizontal: 16, paddingVertical: 14 },
	dateBadge: { alignItems: 'center', borderRadius: 13, gap: 1, height: 48, justifyContent: 'center', width: 44 },
	dateDay: { fontSize: 18, lineHeight: 18 },
	dateMonth: { fontSize: 9, letterSpacing: 0.72 },
	copy: { flex: 1, minWidth: 0 },
	title: { fontSize: 12.5 },
	desc: { fontSize: 11, lineHeight: 16, marginTop: 2 }
});
