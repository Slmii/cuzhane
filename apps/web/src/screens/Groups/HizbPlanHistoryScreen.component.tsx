import { useHintScreen } from '@/components/Hints/useHintScreen';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import type { HizbAssignment } from '@/api/hizbReading.api';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useHizbReading } from '@/lib/hooks/useHizbReading';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { planReadingRoute } from '@/lib/utils/personalPlan';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { HizbPlanHistorySkeleton } from './HizbPlanHistorySkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbPlanHistory'>;

/**
 * T3 of "Hizb Kişisel Plan" — every reading of the viewer's, newest to oldest, opened from the
 * group screen's rounds card. One continuous list with no round headers or page numbers; the next
 * page loads as it nears its end. An unread day (today, or one missed) has "Oku"; a read one a
 * check. Every row opens its reading.
 *
 * **A windowed list**, drawn as one card row by row: the first carries the top corners, the last
 * the bottom ones.
 */
export const HizbPlanHistoryScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	// One card that says what this page is for.
	useHintScreen('planHistory');
	const { t } = useTranslation();
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

	// Today first, then every loaded page.
	const readings = useMemo(() => {
		const pages = query.data?.pages ?? [];
		const today = pages[0]?.today;

		return [...(today ? [today] : []), ...pages.flatMap(page => page.assignments)];
	}, [query.data]);

	const open = useCallback(
		(assignmentId: string) => navigation.navigate(planReadingRoute(kind), { assignmentId, groupId }),
		[groupId, kind, navigation]
	);

	const loadMore = useCallback(() => {
		if (query.hasNextPage && !query.isFetchingNextPage) {
			void query.fetchNextPage();
		}
	}, [query]);

	// Either failing is the screen's failure: the skeleton waits for both, and must not wait forever.
	if (query.isError || (groupQuery.isError && !groupKind)) {
		return <ErrorState queries={[query, groupQuery]} />;
	}

	if (!data || !groupKind) {
		return <HizbPlanHistorySkeleton />;
	}

	const renderReading = ({ index, item: reading }: { index: number; item: HizbAssignment }) => (
		<Pressable
			accessibilityRole='button'
			onPress={() => open(reading.id)}
			style={({ pressed }) => [
				styles.row,
				{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
				index === 0
					? [styles.rowFirst, { borderTopColor: theme.colors.border }]
					: { borderTopColor: theme.colors.divider },
				index === readings.length - 1 ? styles.rowLast : null
			]}
		>
			<Typography color={theme.colors.faintText} style={styles.date} variant='mono' weight='medium'>
				{text.monthDay(reading.date, 'short')}
			</Typography>
			<CaptionText numberOfLines={1} style={styles.title} weight='semibold'>
				{text.partsLabel(reading)}
				<CaptionText color={theme.colors.faintText} style={styles.title}>
					{` · ${text.partsAside(reading)}`}
				</CaptionText>
			</CaptionText>
			{reading.completedAt ? (
				<View style={[styles.chip, { backgroundColor: theme.colors.accentSoft }]}>
					<Icon color={theme.colors.accent} name='check' size={14} strokeWidth={2.2} />
					<CaptionText color={theme.colors.accent} style={styles.chipLabel} weight='semibold'>
						{t('hpStatusRead')}
					</CaptionText>
				</View>
			) : (
				<AppButton
					fullWidth={false}
					onPress={() => open(reading.id)}
					size='sm'
					title={t('hpReadAction')}
					variant='primary'
				/>
			)}
		</Pressable>
	);

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<PullToRefresh {...pullToRefresh}>
				<FlatList
					contentContainerStyle={styles.listContent}
					data={readings}
					initialNumToRender={14}
					keyExtractor={reading => reading.id}
					ListFooterComponent={
						query.isFetchingNextPage ? (
							<ActivityIndicator color={theme.colors.faintText} style={styles.loading} />
						) : null
					}
					ListHeaderComponent={
						<ScreenHeader
							hasBackButton
							subtitle={
								data.enrollment && data.currentRound
									? t('hpHistorySubtitle', {
											days: data.enrollment.planDays,
											n: data.currentRound.number
									  })
									: undefined
							}
							title={t('hpHistoryTitle')}
						/>
					}
					maxToRenderPerBatch={14}
					nestedScrollEnabled
					onEndReached={loadMore}
					onEndReachedThreshold={0.6}
					renderItem={renderReading}
					showsVerticalScrollIndicator={false}
					windowSize={9}
				/>
			</PullToRefresh>
		</ScreenContainer>
	);
};

/* The design's measures, one to one (T3 of "Hizb Kişisel Plan"). */
const styles = StyleSheet.create({
	flush: { paddingHorizontal: 0 },
	listContent: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 8 },
	loading: { marginTop: 14 },
	row: {
		alignItems: 'center',
		borderLeftWidth: StyleSheet.hairlineWidth,
		borderRightWidth: StyleSheet.hairlineWidth,
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 10
	},
	rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 12 },
	rowLast: {
		borderBottomLeftRadius: 18,
		borderBottomRightRadius: 18,
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 12
	},
	date: { fontSize: 11, width: 52 },
	title: { flex: 1, fontSize: 12.5, minWidth: 0 },
	chip: {
		alignItems: 'center',
		borderRadius: 7,
		flexDirection: 'row',
		gap: 4,
		paddingHorizontal: 9,
		paddingVertical: 5
	},
	chipLabel: { fontSize: 10.5 }
});
