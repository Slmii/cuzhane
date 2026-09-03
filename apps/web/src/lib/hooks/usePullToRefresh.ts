import type { PullToRefreshState } from '@/components/ui/PullToRefresh/PullToRefresh.types';
import { useCallback, useEffect, useRef, useState } from 'react';

/** The slice of a query result a pull needs. `UseQueryResult` satisfies it. */
export interface Refetchable {
	refetch: () => Promise<unknown>;
}

/**
 * The state behind a pull-to-refresh, for a screen's queries: a screen with two of them
 * writes `const pullToRefresh = usePullToRefresh(groupQuery, babsQuery)` and hands the result
 * to `ScreenContainer` or wraps its list in `PullToRefresh` with it. The drawing is theirs;
 * this is only *when* it spins.
 *
 * The flag is the hook's own, up for exactly as long as *this pull's* refetches run —
 * deliberately not the query's `isRefetching`, which is also true during focus and reconnect
 * refetches, when a spinner dropping in from the top of a list the reader never pulled reads
 * as the app doing something to them. The queries are read through a ref at pull time rather
 * than captured, so `onRefresh` keeps one identity across renders.
 */
export const usePullToRefresh = (...queries: Refetchable[]): PullToRefreshState => {
	const [isRefreshing, setIsRefreshing] = useState(false);
	const latestQueries = useRef(queries);

	useEffect(() => {
		latestQueries.current = queries;
	});

	const onRefresh = useCallback(async () => {
		setIsRefreshing(true);

		try {
			await Promise.all(latestQueries.current.map(query => query.refetch()));
		} finally {
			setIsRefreshing(false);
		}
	}, []);

	return { isRefreshing, onRefresh };
};
