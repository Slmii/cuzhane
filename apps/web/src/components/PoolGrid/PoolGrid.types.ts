import type { PoolCell } from '@/lib/utils/groups';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PoolGridProps {
	/** Every bab in the pool, in order, carrying which of the three states it is in. */
	cells: PoolCell[];
	/**
	 * Slots being handed back right now. Their cells drain in the opposite direction to the
	 * üstlen sweep — last bab first — so giving a block up reads as the claim run backwards
	 * rather than as another fill.
	 */
	drainingSlotIndexes?: number[];
	style?: StyleProp<ViewStyle>;
}
