import type { StyleProp, ViewStyle } from 'react-native';

export type CellGridItem = {
	key: string | number;
	backgroundColor: string;
	borderColor?: string;
	label?: string | number;
	labelColor?: string;
	accessibilityLabel?: string;
	/**
	 * Draws the design's diagonal hatch over the cell. Reserved for the shared pool, which
	 * has to read as "nobody's yet" rather than as another progress colour.
	 */
	isHatched?: boolean;
	/**
	 * Delay (ms) before this cell's colour transition starts — `pool-fill.html`'s
	 * `--i × --fill-step`. Set per cell to sweep a block left to right as it is claimed.
	 */
	fillDelay?: number;
	/** When set, the cell pops in on mount after this delay (ms) — design 05's `sg-pop`. */
	entryDelay?: number;
	/**
	 * Marks a cell that has just been removed and is only still rendered so it can leave.
	 * It shrinks away after this delay (ms) — design 05's `om-shrink`, which the prototype
	 * calls a "ghost". The caller drops it once the animation is done.
	 */
	ghostDelay?: number;
};

export interface CellGridProps {
	items: CellGridItem[];
	columns: number;
	gap?: number;
	radius?: number;
	borderWidth?: number;
	onPressCell?: (key: string | number) => void;
	style?: StyleProp<ViewStyle>;
}
