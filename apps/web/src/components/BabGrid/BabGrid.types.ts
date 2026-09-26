import type { StyleProp, ViewStyle } from 'react-native';

/**
 * `pool` is a bab belonging to a seat nobody took — drawn hatched, because it is the one
 * state that isn't about progress. `open` is the same colour without the hatch and is
 * only used by the loading placeholder, which must not imply a board full of pool babs.
 */
export type BabCellState = 'readByMe' | 'mineUnread' | 'readByOthers' | 'takenByOthers' | 'pool' | 'open';

export interface BabGridProps {
	/** One entry per part the group divides (its `partCount`), but the grid renders whatever it is given. */
	cells: { number: number; state: BabCellState }[];
	columns?: number;
	onPressBab?: (babNumber: number) => void;
	style?: StyleProp<ViewStyle>;
}
