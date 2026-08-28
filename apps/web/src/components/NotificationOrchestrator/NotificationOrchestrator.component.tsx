import { useNotificationNavigation } from '@/lib/hooks/useNotificationNavigation';
import { usePushTokenRegistration } from '@/lib/hooks/usePushTokenRegistration';
import { useReminderNotificationSync } from '@/lib/hooks/useReminderNotificationSync';

/**
 * Renders nothing; it exists so the reminder reconciler runs for the whole session rather
 * than only while the Reminders tab happens to be mounted. Notifications are an
 * app-lifetime concern — the schedule has to be right whether or not anyone visited the
 * screen that configures it.
 *
 * The Android channel is declared by the scheduler itself, immediately before the
 * notification that needs it. Creating it from a mount effect here raced the first
 * schedule, and Android silently drops anything posted to a channel that doesn't exist.
 */
export const NotificationOrchestrator = () => {
	useReminderNotificationSync();
	useNotificationNavigation();
	// Server-sent notifications need somewhere to go. Registered here for the same reason the
	// reconciler is: it must happen whether or not anyone opens the Reminders tab.
	usePushTokenRegistration();

	return null;
};
