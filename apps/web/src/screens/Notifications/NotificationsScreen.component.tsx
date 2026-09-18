import { NotificationRow } from '@/components/NotificationRow/NotificationRow.component';
import { TourTarget } from '@/components/Tour/TourTarget.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { FieldLabelText } from '@/components/ui/Typography/Typography.component';
import {
	useGetNotifications,
	useMarkAllNotificationsRead,
	useUnreadNotificationCount
} from '@/lib/hooks/useNotifications';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { groupNotifications } from '@/lib/utils/notifications';
import { useIsFocused } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NotificationsSkeleton } from './NotificationsSkeleton.component';

/**
 * P2 — the notification inbox.
 *
 * **Everything that happened, not everything that buzzed.** A row is filed whether or not a push
 * went out, which is the design's own rule: in-app notifications are always on and the phone
 * preferences only govern the interruption. So this is the place a reader who keeps their phone
 * quiet still finds out their group finished.
 *
 * **No filter chips.** The prototype defines `ntFilters` (Tümü / Gruplar / Uygulama) in its state
 * but no frame renders them, and every event the app can currently raise is a group event — three
 * of the three. A filter whose every row lands in one bucket is furniture. It belongs here the
 * day a second kind of event exists.
 */
export const NotificationsScreen = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const notificationsQuery = useGetNotifications();
	const markAllRead = useMarkAllNotificationsRead();
	const { data: unreadCount = 0 } = useUnreadNotificationCount();
	const pullToRefresh = usePullToRefresh(notificationsQuery);

	/*
	 * One clock for the whole list, refreshed when the screen is focused. Every row ages against
	 * it, so two rows a second apart cannot disagree about which of them is "now" — and a list
	 * left open in the background does not silently drift.
	 */
	const isFocused = useIsFocused();
	const [now, setNow] = useState(() => new Date());
	const [wasFocused, setWasFocused] = useState(isFocused);

	if (isFocused !== wasFocused) {
		setWasFocused(isFocused);

		if (isFocused) {
			setNow(new Date());
		}
	}

	const rows = notificationsQuery.data;
	const groups = useMemo(() => groupNotifications(rows ?? [], now), [now, rows]);
	/*
	 * **From the count, not from the rows.** The list is the newest hundred; the badge counts
	 * every unread row there is. Derived from the rows, the action disappeared once those
	 * hundred were read while something older was not — leaving a badge with no way to clear it.
	 */
	const hasUnread = unreadCount > 0;

	const labelFor = { earlier: t('notifEarlier'), today: t('notifToday'), week: t('notifThisWeek') };

	if (notificationsQuery.isPending) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<NotificationsSkeleton />
			</ScreenContainer>
		);
	}

	if (notificationsQuery.isError || !rows) {
		return <ErrorState queries={[notificationsQuery]} />;
	}

	return (
		<ScreenContainer pullToRefresh={pullToRefresh} shouldIncludeTabBarOffset>
			{/*
			 * A tab root, so no back band — the bell in the bottom bar is how you get here, and
			 * the gear in the navigator's bar is how you leave for the settings this tab used to
			 * hold.
			 */}
			<ScreenTitle
				isUnderNavigationBar
				label={t('notifInboxTitle')}
				{...(hasUnread
					? {
							action: (
								<Pressable accessibilityRole='button' onPress={() => markAllRead.mutate()}>
									<FieldLabelText color={theme.colors.accent}>{t('notifMarkAll')}</FieldLabelText>
								</Pressable>
							)
					  }
					: {})}
			/>
			{groups.length === 0 ? (
				<EmptyState description={t('notifEmptySub')} icon='bell' title={t('notifEmptyTitle')} />
			) : (
				groups.map((group, index) => {
					const rows = (
						<View style={styles.rows}>
							{group.items.map(notification => (
								<NotificationRow key={notification.id} notification={notification} now={now} />
							))}
						</View>
					);

					return (
						<View key={group.bucket} style={styles.group}>
							<FieldLabelText color={theme.colors.faintText}>{labelFor[group.bucket]}</FieldLabelText>
							{/*
							 * Stop 11 of the first-use tour frames the **first bucket's rows**, and
							 * not its heading: "Bugün" is a date, and a spotlight around it reads as
							 * the stop being about the grouping rather than about the notifications.
							 * Nor the whole list — a target the height of the screen leaves the card
							 * nowhere to sit, and the newest rows are what the stop is about.
							 */}
							{index === 0 ? <TourTarget id='inbox'>{rows}</TourTarget> : rows}
						</View>
					);
				})
			)}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	group: {
		gap: 6
	},
	// The rows carry their own spacing so the tour can frame them without the bucket's heading.
	rows: {
		gap: 6
	}
});
