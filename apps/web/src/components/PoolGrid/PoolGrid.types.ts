import type { PoolCell } from '@/lib/utils/groups';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PoolGridProps {
	/** Every bab in the pool, in order, carrying which of the three states it is in. */
	cells: PoolCell[];
	style?: StyleProp<ViewStyle>;
}
