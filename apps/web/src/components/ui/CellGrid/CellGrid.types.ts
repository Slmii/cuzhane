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
	/** When set, the cell zooms in on mount after this delay (ms) and shrinks out on removal. */
	entryDelay?: number;
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
