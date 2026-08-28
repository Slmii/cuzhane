import {
	buildContentSignature,
	buildTriggerSignature,
	type ReminderContent,
	type ReminderSchedule
} from '@/lib/utils/notifications/reminderSignatures';
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

const parseTime = (time: string) => {
	const [hour, minute] = time.split(':').map(Number);

	return { hour: hour || 0, minute: minute || 0 };
};

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
 * One repeating daily trigger rather than a run of dated ones. The OS owns the repeat, so
 * the reminder keeps arriving whether the app is backgrounded, force-quit or never opened
 * again — which is the whole point of scheduling it locally instead of waiting for a push.
 */
export const scheduleReminder = async (schedule: ReminderSchedule, content: ReminderContent) => {
	if (!isNativePlatform || !schedule.isEnabled) {
		return null;
	}

	await ensureAndroidChannel();

	const { hour, minute } = parseTime(schedule.time);

	return Notifications.scheduleNotificationAsync({
		content: {
			title: content.title,
			body: content.body,
			sound: true,
			data: {
				kind: REMINDER_KIND,
				triggerSig: buildTriggerSignature(schedule),
				contentSig: buildContentSignature(content)
			}
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DAILY,
			hour,
			minute,
			channelId: REMINDER_CHANNEL_ID
		}
	});
};

export const readSignatures = (notification: Notifications.NotificationRequest) => ({
	contentSig: asString(notification.content?.data?.contentSig),
	triggerSig: asString(notification.content?.data?.triggerSig)
});
