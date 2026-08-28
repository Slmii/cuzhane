import { registerDeviceForPush } from '@/lib/utils/notifications/pushRegistration';
import { useAuth } from '@clerk/expo';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Asks for notification permission once, when Ana sayfa first appears.
 *
 * Home is the moment to ask: the reader has signed in and arrived at the screen that is
 * *about* being reminded, so the dialog lands next to the thing it is for. Asking during
 * onboarding would come before any of it means anything, and asking from the reconciler
 * would fire on every launch.
 *
 * **Only when a dialog would actually appear.** iOS shows the prompt exactly once; after
 * that `requestPermissionsAsync` resolves silently against the stored answer. Gating on
 * `canAskAgain` keeps this from being a pointless call on every single launch, and means a
 * reader who said no is never asked twice.
 *
 * Granting registers the push token immediately. Without that the device would have no
 * token until the next launch, and would miss anything sent in between.
 */
export const useNotificationPermissionPrompt = () => {
	const { isSignedIn } = useAuth();
	/** One attempt per app session, whatever the answer. */
	const hasAsked = useRef(false);

	useEffect(() => {
		// Notifications are a device concern; the web build has no equivalent to ask for.
		if (!isSignedIn || hasAsked.current || Platform.OS === 'web') {
			return;
		}

		hasAsked.current = true;

		const run = async () => {
			const current = await Notifications.getPermissionsAsync();

			if (current.granted) {
				return;
			}

			// Denied already, and iOS won't show the dialog again — asking would do nothing
			// except waste a round trip. Settings is the only way back from here.
			if (!current.canAskAgain) {
				return;
			}

			const requested = await Notifications.requestPermissionsAsync();

			if (requested.granted) {
				await registerDeviceForPush();
			}
		};

		void run();
	}, [isSignedIn]);
};
