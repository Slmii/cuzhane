import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import type { HizbHistoryDays } from '@/api/hizbReading.api';
import { useHizbHistoryDays } from '@/lib/hooks/useHizbReading';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { HizbGroupHistorySkeleton } from './HizbGroupHistorySkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbGroupHistory'>;
type Day = HizbHistoryDays['days'][number];

/**
 * "Tüm geçmiş" of a shared plan: the group's days, today first, each with how many of its readers
 * read. A day opens its readers (`HizbReaders` with the day), where only the viewer's own unread
 * row has "Oku". A day row is a few numbers, so a big group's history stays short; the next thirty
 * days load as the list nears its end.
 *
 * **A windowed list**, drawn as one card row by row: the first carries the top corners, the last
 * the bottom ones.
 */
export const HizbGroupHistoryScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const text = useHizbPlanText();
	const query = useHizbHistoryDays(groupId);
	const pullToRefresh = usePullToRefresh(query);
	const days = useMemo(() => query.data?.pages.flatMap(page => page.days) ?? [], [query.data]);

	const loadMore = useCallback(() => {
		if (query.hasNextPage && !query.isFetchingNextPage) {
			void query.fetchNextPage();
		}
	}, [query]);

	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}

	if (!query.data) {
		return <HizbGroupHistorySkeleton />;
	}

	const renderDay = ({ index, item: day }: { index: number; item: Day }) => {
		const isComplete = day.readers > 0 && day.read === day.readers;

		return (
			<Pressable
				accessibilityRole='button'
				onPress={() => navigation.navigate('HizbReaders', { day: day.day, groupId })}
				style={({ pressed }) => [
					styles.row,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.border,
						opacity: pressed ? 0.7 : 1
					},
					index === 0
						? [styles.rowFirst, { borderTopColor: theme.colors.border }]
						: { borderTopColor: theme.colors.divider },
					index === days.length - 1 ? styles.rowLast : null
				]}
			>
				<Typography
					color={day.isToday ? theme.colors.text : theme.colors.faintText}
					style={styles.date}
					variant='mono'
					weight='medium'
				>
					{day.isToday ? t('today') : text.monthDay(day.date, 'short')}
				</Typography>
				<CaptionText
					color={isComplete ? theme.colors.accent : theme.colors.text}
					numberOfLines={1}
					style={styles.count}
					weight='semibold'
				>
					{t('hpDayReadCount', { read: day.read, readers: day.readers })}
				</CaptionText>
				{isComplete ? <Icon color={theme.colors.accent} name='check' size={15} strokeWidth={2.2} /> : null}
				<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
			</Pressable>
		);
	};

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<PullToRefresh {...pullToRefresh}>
				<FlatList
					contentContainerStyle={styles.listContent}
					data={days}
					initialNumToRender={14}
					keyExtractor={day => String(day.day)}
					ListFooterComponent={
						query.isFetchingNextPage ? (
							<ActivityIndicator color={theme.colors.faintText} style={styles.loading} />
						) : null
					}
					ListHeaderComponent={
						<ScreenHeader
							hasBackButton
							subtitle={t('hpGroupHistorySubtitle')}
							title={t('hpHistoryTitle')}
						/>
					}
					maxToRenderPerBatch={14}
					nestedScrollEnabled
					onEndReached={loadMore}
					onEndReachedThreshold={0.6}
					renderItem={renderDay}
					showsVerticalScrollIndicator={false}
					windowSize={9}
				/>
			</PullToRefresh>
		</ScreenContainer>
	);
};

/* The measures of `HizbPlanHistoryScreen`, its sibling list. */
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
		paddingVertical: 14
	},
	rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
	rowLast: {
		borderBottomLeftRadius: 18,
		borderBottomRightRadius: 18,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	date: { fontSize: 11, width: 52 },
	count: { flex: 1, fontSize: 12.5, minWidth: 0 }
});
