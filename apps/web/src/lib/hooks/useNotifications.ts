import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead } from '@/api/notifications.api';
import { notificationQueryKeys } from '@/lib/hooks/queryKeys';
import { useLiveRefetchInterval } from '@/lib/hooks/useLiveRefetchInterval';
import { useRefetchOnFocus } from '@/lib/hooks/useRefetchOnFocus';
import { AppNotification } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The inbox itself (design P2). */
export const useGetNotifications = () => {
	const refetchInterval = useLiveRefetchInterval();

	const query = useQuery({
		queryKey: notificationQueryKeys.list(),
		queryFn: getNotifications,
		/*
		 * **The same cadence as the badge.** The count polled and this did not, and the tabs stay
		 * mounted — so the bell counted up while the list behind it kept showing the rows from
		 * whenever the app was opened, until someone thought to pull.
		 */
		refetchInterval
	});

	/*
	 * **And once on arrival.** The interval above only starts when the tab is opened, so its
	 * first tick lands half a minute after you are already looking at the list — which left the
	 * inbox showing the rows it had at launch while the bell beside it counted a newer one.
	 */
	useRefetchOnFocus(query.refetch);

	return query;
};

/**
 * The bell's badge (design P1).
 *
 * It rides the same live interval the rest of Ana sayfa uses, so the badge keeps pace with the
 * screen it sits on rather than inventing a cadence of its own.
 */
export const useUnreadNotificationCount = () => {
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: notificationQueryKeys.unreadCount(),
		queryFn: async () => (await getUnreadNotificationCount()).count,
		refetchInterval
	});
};

/**
 * "Tümünü okundu say" — the only way a row is marked read.
 *
 * There used to be a per-row mutation too, fired by opening a notification. Rows are inert now
 * (see `NotificationRow`), so this is the whole of it; `PATCH /:id/read` still exists on the
 * server, unreferenced, the way `Cheer` does.
 */
export const useMarkAllNotificationsRead = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: markAllNotificationsRead,
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey: notificationQueryKeys.root() });

			const previousList = queryClient.getQueryData<AppNotification[]>(notificationQueryKeys.list());
			const previousCount = queryClient.getQueryData<number>(notificationQueryKeys.unreadCount());

			queryClient.setQueryData<AppNotification[]>(notificationQueryKeys.list(), current =>
				current?.map(row => ({ ...row, isRead: true }))
			);
			queryClient.setQueryData<number>(notificationQueryKeys.unreadCount(), 0);

			return { previousCount, previousList };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousList) {
				queryClient.setQueryData(notificationQueryKeys.list(), context.previousList);
			}
			if (context?.previousCount !== undefined) {
				queryClient.setQueryData(notificationQueryKeys.unreadCount(), context.previousCount);
			}
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.root() });
		}
	});
};
