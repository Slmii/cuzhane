import { deletePushToken } from '@/api/pushToken.api';
import { registerDeviceForPush } from '@/lib/utils/notifications/pushRegistration';
import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';

/**
 * Keeps this device's Expo push token registered against the signed-in account.
 *
 * Without this the `PushToken` table stays empty and the server has nowhere to send: the
 * endpoint and the table existed all along, but nothing ever called them.
 *
 * It only registers a device that *already* has permission — the asking is Home's job, at
 * a moment chosen for it. This runs on every launch, and a hook that prompted would throw
 * the system dialog at someone who merely reopened the app.
 *
 * The token is remembered so signing out can withdraw it. Left behind, the next
 * notification for this account would arrive on a phone somebody else is now signed in on.
 */
export const usePushTokenRegistration = () => {
	const { isSignedIn } = useAuth();
	/** The token last registered, so it can be withdrawn on sign-out. */
	const registered = useRef<string | null>(null);

	useEffect(() => {
		let isCancelled = false;

		const run = async () => {
			if (!isSignedIn) {
				const previous = registered.current;

				registered.current = null;

				if (previous) {
					try {
						await deletePushToken(previous);
					} catch {
						// Signing out is not held up by a failed cleanup — the token is re-pointed
						// at whoever signs in next anyway, since it is unique on the server.
					}
				}

				return;
			}

			const token = await registerDeviceForPush();

			if (!isCancelled && token) {
				registered.current = token;
			}
		};

		void run();

		return () => {
			isCancelled = true;
		};
	}, [isSignedIn]);
};
