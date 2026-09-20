import { navigationRef } from '@/navigation/navigationRef';
import { useLastNotificationResponse } from 'expo-notifications';
import { useEffect, useRef } from 'react';

/** How long to wait before asking the container again. Matches `linkGate`'s own poll. */
const READY_POLL_MS = 50;

/**
 * Opening the app from the reminder lands on Ana sayfa.
 *
 * The reminder counts every group, so there is no single bab to open — the home ring is
 * the screen that answers the question it asked ("how much is left today?"), and it is
 * also where each group's own "Oku" sits, one tap from the right bab.
 *
 * `useLastNotificationResponse` rather than a response listener: when the tap *launches*
 * the app, a listener registered on mount can miss the event that started it. This returns
 * the launching response too, so a cold start and a warm one behave the same.
 *
 * **It navigates through `navigationRef`, and waits for `isReady()`.** That cold start is
 * exactly the case `useNavigation` cannot serve: the launching response is available on the
 * first commit, while effects fire child-first, so the container has not finished mounting
 * and the dispatch is dropped with "The 'navigation' object hasn't been initialized yet".
 * `linkGate` holds a scanned URL for the same reason. The response is kept and acted on when
 * the container comes up — the identifier guard below is what stops it firing twice.
 */
export const useNotificationNavigation = () => {
	const response = useLastNotificationResponse();
	/** The response already acted on — the hook keeps returning the same one. */
	const handledIdentifier = useRef<string | null>(null);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const identifier = response?.notification.request.identifier;

		if (!identifier || handledIdentifier.current === identifier) {
			return;
		}

		/*
		 * A server-sent notification says where it came from; the local reminder does not.
		 * Anything carrying a `groupId` is about one group, so it opens that group — landing
		 * on Ana sayfa after being told a specific block changed hands would make the reader
		 * hunt for what they were just told about.
		 */
		const data = response?.notification.request.content.data;
		const groupId = typeof data?.groupId === 'string' ? data.groupId : null;

		handledIdentifier.current = identifier;

		/*
		 * **Polled, not retried on the next render.** Nothing re-renders this hook when the
		 * container finishes mounting — `useLastNotificationResponse` keeps returning the same
		 * object — so waiting for a later commit would wait forever. `linkGate.releasePending`
		 * holds a scanned URL the same way and for the same reason.
		 */
		const open = () => {
			if (!navigationRef.isReady()) {
				timer = setTimeout(open, READY_POLL_MS);

				return;
			}

			if (groupId) {
				/*
				 * **`initial: false`, or the group becomes the Groups stack's only route.** A
				 * nested `navigate` that reaches a navigator before it has registered its own
				 * state builds the stack with just the named screen — back does nothing, and
				 * `popToTopOnBlur` then keeps it as that tab's root for the session.
				 * `JoinedWelcomeScreen` documents the same trap. The cold-start path is exactly
				 * where the Groups stack may not have mounted yet when the poll below fires.
				 */
				navigationRef.navigate('Tabs', {
					screen: 'Groups',
					params: { screen: 'GroupDetail', params: { groupId }, initial: false }
				});

				return;
			}

			navigationRef.navigate('Tabs', { screen: 'Home' });
		};

		open();

		return () => {
			if (timer !== undefined) {
				clearTimeout(timer);
			}
		};
	}, [response]);
};
