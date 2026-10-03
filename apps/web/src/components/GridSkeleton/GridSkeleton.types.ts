import type { StyleProp, ViewStyle } from 'react-native';

export interface GridSkeletonProps {
	/** How many cell placeholders to lay out — match what the real grid will show. */
	cellCount: number;
	/**
	 * Bare, as a board drawn inside a section's card: no card or header of its own, and `BabGrid` /
	 * `BabLegend`'s own measures, so the board lands where its bones stood.
	 */
	isBare?: boolean;
	columns?: number;
	/** The chip-and-bars row above the lattice. */
	hasHeader?: boolean;
	/** How many legend items to stub under the lattice; 0 draws none. */
	legendCount?: number;
	style?: StyleProp<ViewStyle>;
}
