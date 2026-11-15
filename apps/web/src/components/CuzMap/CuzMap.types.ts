import type { StyleProp, ViewStyle } from 'react-native';

/**
 * What a cüz is, on any of the maps that draw the thirty.
 *
 * **`free` is the hatched one**, everywhere — the same stripes the bab board and the pool
 * use for "belongs to nobody yet". `taken` is somebody's and plain; `mine` is solid;
 * `read` is finished, whoever finished it.
 */
export type CuzCellState = 'free' | 'mine' | 'read' | 'taken';

export interface CuzMapProps {
	stateOf: (cuzNumber: number) => CuzCellState;
	/**
	 * A second, smaller line inside the cell — whose cüz it is ("Zeynep", "sen").
	 *
	 * The design puts it on every cüz map that has holders to name; return an empty string
	 * for a cell with nobody on it. Omit the prop entirely on a map that names no one.
	 */
	labelOf?: (cuzNumber: number) => string;
	/** Omit for a read-only map — the lobby's, which reports rather than offers. */
	onPress?: (cuzNumber: number) => void;
	/** Which cells respond. Ignored without `onPress`. */
	isPressable?: (cuzNumber: number) => boolean;
	/**
	 * The two geometries the design draws the thirty in.
	 *
	 * `picker` (default) is six across with a 9pt radius — a cell you aim a thumb at, and
	 * big enough to carry a name. `compact` is ten across at a 4pt radius, the map a screen
	 * *reports* with: the join previews and the lobby, where it is a picture of the round
	 * rather than a control.
	 */
	variant?: 'compact' | 'picker';
	style?: StyleProp<ViewStyle>;
}

export interface CuzMapLegendProps {
	/** What a solid cell is called here — "senin" when reporting, "seçtin" when picking. */
	mineLabel?: string;
	/**
	 * What a hatched cell is called here. Defaults to "havuz", the word every board uses for
	 * the shared pool; the picker overrides it with "boşta", because there it is not a place
	 * you are being pointed at but the state of the cells you may take.
	 */
	freeLabel?: string;
	/** Which states this map actually draws. Defaults to the three a member's map has. */
	states?: CuzCellState[];
}
