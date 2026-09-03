import type { Refetchable } from '@/lib/hooks/usePullToRefresh';

/** The slice of a query result the error page needs. `UseQueryResult` satisfies it. */
export interface Retryable extends Refetchable {
	error: unknown;
	isFetching: boolean;
}

export interface ErrorStateProps {
	/**
	 * The screen's queries. The first error among them feeds the footer's HTTP status,
	 * "Tekrar dene" refetches all of them, and the button spins while any is fetching.
	 */
	queries: Retryable[];
}
