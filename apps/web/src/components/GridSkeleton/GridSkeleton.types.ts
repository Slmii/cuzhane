import type { StyleProp, ViewStyle } from 'react-native';

export interface GridSkeletonProps {
	/** How many cell placeholders to lay out — match what the real grid will show. */
	cellCount: number;
	columns?: number;
	/** The chip-and-bars row above the lattice. */
	hasHeader?: boolean;
	/** How many legend items to stub under the lattice; 0 draws none. */
	legendCount?: number;
	style?: StyleProp<ViewStyle>;
}
