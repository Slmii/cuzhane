import { registerPushToken } from '@/api/pushToken.api';
import { hasReminderPermission } from '@/lib/utils/notifications/reminderNotifications';
import Constants from 'expo-constants';
import { getExpoPushTokenAsync } from 'expo-notifications';

/**
 * Registers this device's Expo push token against the signed-in account.
 *
 * Shared because two things need to do it and they can't be one: the orchestrator registers
 * on launch for a device that already has permission, and the Home prompt registers the
 * moment permission is newly granted. Without the second, a user who accepts the prompt
 * would have no token until the *next* launch — and would miss everything until then.
 *
 * Idempotent: the server upserts on the token, which is unique, so calling twice is free.
 * Returns the token so the caller can withdraw it on sign-out.
 *
 * **Reads permission, never asks.** Whoever prompts does so deliberately and calls this
 * afterwards; nothing here should ever surface a system dialog on its own.
 */
export const registerDeviceForPush = async (): Promise<string | null> => {
	try {
		if (!(await hasReminderPermission())) {
			return null;
		}

		const projectId = Constants.expoConfig?.extra?.eas?.projectId;

		if (typeof projectId !== 'string') {
			// A build with no EAS project id cannot mint a token, and there is nothing the
			// reader could do about it — so it stays out of their way.
			return null;
		}

		const { data: token } = await getExpoPushTokenAsync({ projectId });

		await registerPushToken(token);

		return token;
	} catch {
		// A simulator has no APNs device token and this throws there every time. The daily
		// reminder is local and unaffected, so there is nothing worth interrupting anyone over.
		return null;
	}
};
