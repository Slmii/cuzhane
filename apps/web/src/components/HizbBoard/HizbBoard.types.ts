import type { HizbBoardCell } from '@/lib/utils/groups';
import type { StyleProp, ViewStyle } from 'react-native';

export interface HizbBoardProps {
	/**
	 * Every portion, in order — `hizbBoardCells`. Hold its identity with `useMemo`: the cells
	 * are memoised, and a fresh array each render rebuilds all thirty-three of them.
	 */
	cells: HizbBoardCell[];
	/** The heading's "Fihrist ›" link, drawn only when given. */
	onPressIndex?: () => void;
	style?: StyleProp<ViewStyle>;
}

export interface HizbBoardSkeletonProps {
	style?: StyleProp<ViewStyle>;
}

export interface HizbLegendProps {
	style?: StyleProp<ViewStyle>;
}
