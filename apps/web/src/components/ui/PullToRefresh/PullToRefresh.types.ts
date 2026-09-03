import type { ReactElement } from 'react';
import type { ScrollViewProps } from 'react-native';

/** What `usePullToRefresh` returns and `PullToRefresh` / `ScreenContainer` take. */
export interface PullToRefreshState {
	isRefreshing: boolean;
	onRefresh: () => void;
}

export interface PullToRefreshProps extends PullToRefreshState {
	/** The one scrollable — a `ScrollView` or `FlatList` — that pulls. */
	children: ReactElement<ScrollViewProps>;
}
