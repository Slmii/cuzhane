import { buildReminderKey, type ReminderNotice } from '@/lib/utils/notifications/reminderSignatures';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Android needs a channel before anything can be posted to it. */
export const REMINDER_CHANNEL_ID = 'reminders';

/**
 * Stamped into every notification this app schedules, so the reconciler can tell its own
 * work from anything else on the device and never cancels a notification it didn't create.
 */
const REMINDER_KIND = 'daily-reminder';

const isNativePlatform = Platform.OS !== 'web';

const asString = (value: unknown) => (typeof value === 'string' ? value : null);

/** Only the reminders this app scheduled, never anything else on the device. */
export const getScheduledReminders = async () => {
	if (!isNativePlatform) {
		return [];
	}

	const scheduled = await Notifications.getAllScheduledNotificationsAsync();

	return scheduled.filter(notification => asString(notification.content?.data?.kind) === REMINDER_KIND);
};

/**
 * Reads the standing answer; never asks. The reconciler runs on every launch and on every
 * return to the foreground, so requesting from there would throw the system dialog at
 * someone who had merely opened the app. The Reminders screen owns the prompt, at the
 * moment the switch is turned on — which is the only moment it makes sense.
 */
export const hasReminderPermission = async () => {
	if (!isNativePlatform) {
		return false;
	}

	const current = await Notifications.getPermissionsAsync();

	return current.granted;
};

/**
 * Android silently drops a notification posted to a channel that doesn't exist, and the
 * channel is cheap and idempotent to declare — so it is created here, immediately before
 * the notification that needs it, rather than racing it from a mount effect.
 */
const ensureAndroidChannel = async () => {
	if (Platform.OS !== 'android') {
		return;
	}

	await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
		importance: Notifications.AndroidImportance.HIGH,
		name: 'Reminders'
	});
};

export const cancelReminders = async () => {
	const scheduled = await getScheduledReminders();

	await Promise.all(
		scheduled.map(notification => Notifications.cancelScheduledNotificationAsync(notification.identifier))
	);
};

/**
 * The reminders, each on its own date. Dated rather than a repeating daily trigger, so a day with
 * nothing unread can simply have none (`plannedReminders`); the app writes the coming days again
 * each time it opens. The channel is declared once, then every reminder is written together — a
 * set written one by one is a longer window for a crash to leave it half there.
 */
export const scheduleReminders = async (notices: ReminderNotice[]) => {
	if (!isNativePlatform || notices.length === 0) {
		return;
	}

	await ensureAndroidChannel();
	await Promise.all(notices.map(scheduleReminder));
};

const scheduleReminder = (notice: ReminderNotice) =>
	Notifications.scheduleNotificationAsync({
		content: {
			title: notice.title,
			body: notice.body,
			sound: true,
			data: { kind: REMINDER_KIND, key: buildReminderKey(notice) }
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: notice.at,
			channelId: REMINDER_CHANNEL_ID
		}
	});

/** The key a scheduled reminder was stamped with — `null` for one written by an older build. */
export const readReminderKey = (notification: Notifications.NotificationRequest) =>
	asString(notification.content?.data?.key);
