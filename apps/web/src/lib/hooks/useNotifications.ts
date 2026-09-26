import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead } from '@/api/notifications.api';
import { notificationQueryKeys, tourDemoQueryKeys } from '@/lib/hooks/queryKeys';
import { useIsTourDemo } from '@/components/Tour/Tour.context';
import { useLiveRefetchInterval } from '@/lib/hooks/useLiveRefetchInterval';
import { useRefetchOnFocus } from '@/lib/hooks/useRefetchOnFocus';
import { AppNotification } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The tour's inbox: nothing, so the bell carries no badge while it runs. */
const NO_NOTIFICATIONS: AppNotification[] = [];

/**
 * The inbox itself (design P2).
 *
 * **Empty during the tour**, under a key of its own, like the five hooks in `useGetGroups`'s
 * note. The tour hands the app a stand-in shelf of three groups; real rows would name groups
 * that are not on screen, and the badge would count events from an account the walkthrough is
 * pretending does not have one.
 */
export const useGetNotifications = () => {
	const isDemo = useIsTourDemo();
	const refetchInterval = useLiveRefetchInterval();

	const query = useQuery({
		queryKey: isDemo ? tourDemoQueryKeys.notifications() : notificationQueryKeys.list(),
		queryFn: isDemo ? async () => NO_NOTIFICATIONS : getNotifications,
		/*
		 * **The same cadence as the badge.** The count polled and this did not, and the tabs stay
		 * mounted — so the bell counted up while the list behind it kept showing the rows from
		 * whenever the app was opened, until someone thought to pull. Nothing to poll for while
		 * the tour holds the shelf.
		 */
		refetchInterval: isDemo ? false : refetchInterval,
		/*
		 * A `queryFn` is a promise however fast it settles, so without this the first render
		 * after mount is still `isPending` — and this screen's gate is exactly that, so the tour
		 * would flash its skeleton on the way in. The same reason the other five demo hooks
		 * carry it.
		 */
		...(isDemo ? { initialData: () => NO_NOTIFICATIONS, staleTime: Infinity } : {})
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
	const isDemo = useIsTourDemo();
	const refetchInterval = useLiveRefetchInterval();

	return useQuery({
		queryKey: isDemo ? tourDemoQueryKeys.unreadCount() : notificationQueryKeys.unreadCount(),
		// None during the tour, so the badge and the empty list it opens agree.
		queryFn: isDemo ? async () => 0 : async () => (await getUnreadNotificationCount()).count,
		refetchInterval: isDemo ? false : refetchInterval,
		...(isDemo ? { initialData: () => 0, staleTime: Infinity } : {})
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
