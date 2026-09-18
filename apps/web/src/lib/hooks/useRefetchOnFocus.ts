import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

/**
 * Refetches a query the moment its screen is looked at.
 *
 * **A poll is not the same as a fetch on arrival.** `useLiveRefetchInterval` is gated on focus,
 * so a tab root's query starts its timer when you open the tab and lands its first refetch
 * `LIVE_REFETCH_INTERVAL_MS` *later* — and because the tabs are not lazy, the data on screen
 * until then can be as old as the launch. That is what made the notification inbox open on the
 * rows it had at start-up while the bell beside it already counted a new one, with pull-to-refresh
 * the only way to move it.
 *
 * `refetchOnMount` does not help a screen that never unmounts, which is every tab root here.
 *
 * Only on the **transition** into focus, so a re-render while the screen is already open costs
 * nothing. Pass `refetch` itself — TanStack keeps its identity stable, so this depends on a value
 * that does not change every render.
 */
export const useRefetchOnFocus = (refetch: () => unknown) => {
	const isFocused = useIsFocused();
	const wasFocused = useRef(isFocused);

	useEffect(() => {
		if (isFocused && !wasFocused.current) {
			refetch();
		}

		wasFocused.current = isFocused;
	}, [isFocused, refetch]);
};
