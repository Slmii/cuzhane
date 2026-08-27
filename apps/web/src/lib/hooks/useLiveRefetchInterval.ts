import { useIsFocused } from '@react-navigation/native';

/**
 * How often a visible board re-checks the server. A hatim is read once a day, so this is
 * about catching the handful of members finishing on the same evening — not about being
 * live to the second.
 */
export const LIVE_REFETCH_INTERVAL_MS = 30_000;

/**
 * The `refetchInterval` for a query that backs something other people can change while
 * you are looking at it — the 100-bab board, the group cards, the pool.
 *
 * Gated on focus because every tab root stays mounted (`lazy: false` on the navigator, so
 * the bottom bar can keep its stacks). Without the gate, Home, Groups and Discover would
 * each poll on their own timer while you look at one of them. `refetchIntervalInBackground`
 * stays at its default of false, so a backgrounded app polls nothing at all.
 *
 * Must be called from inside a navigation screen — `useIsFocused` needs that context.
 */
export const useLiveRefetchInterval = (): number | false => {
	const isFocused = useIsFocused();

	return isFocused ? LIVE_REFETCH_INTERVAL_MS : false;
};
