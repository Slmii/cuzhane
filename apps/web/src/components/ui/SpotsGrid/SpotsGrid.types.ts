import type { StyleProp, ViewStyle } from 'react-native';

export interface SpotsGridProps {
	total: number;
	filled: number;
	columns?: number;
	/**
	 * The largest `total` the caller can reach, so the lattice reserves that many rows and holds
	 * its height while the count moves. Only the picker needs it — a group's `spots` is immutable
	 * once created, so the lobby's grid never changes size — and it defaults to `total`, which
	 * reserves exactly what is drawn.
	 */
	maxTotal?: number;
	style?: StyleProp<ViewStyle>;
}
