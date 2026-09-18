import { wrapperApi } from '@/api/wrapper.api';
import { AppNotification } from '@/lib/types/domain';

export const getNotifications = async () => wrapperApi<AppNotification[]>('/notifications', { method: 'GET' });

/**
 * The bell's badge, on its own endpoint.
 *
 * Ana sayfa refetches this with the rest of the screen; the list is only fetched when the inbox
 * is opened. Folded together, every Home refresh would carry a hundred rows for one number.
 */
export const getUnreadNotificationCount = async () =>
	wrapperApi<{ count: number }>('/notifications/unread-count', { method: 'GET' });

export const markNotificationRead = async (notificationId: string) =>
	wrapperApi<void>(`/notifications/${notificationId}/read`, { method: 'PATCH' });

export const markAllNotificationsRead = async () => wrapperApi<void>('/notifications/read-all', { method: 'PATCH' });
