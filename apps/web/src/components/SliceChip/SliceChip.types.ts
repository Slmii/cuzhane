import type { StyleProp, ViewStyle } from 'react-native';

export interface SliceChipProps {
	/** How many stretches the reader holds beyond the one shown. Nothing renders below 1. */
	count: number;
	/**
	 * `soft` is the design's hero chip — `accentSoft`, for the ring on Home. `wash` is the
	 * lighter fill it uses inside a list row, where a solid panel would read as a surface of
	 * its own in dark mode. `surface` is for the group heading, whose strip is already
	 * `accentSoft`: a chip in the same tint would vanish into it, so it lifts to the card
	 * colour instead.
	 */
	tone?: 'soft' | 'wash' | 'surface';
	/**
	 * Drops the words and keeps the count — "+1" rather than "+1 aralık daha". For the shelf
	 * row, whose range column is 56pt wide: the full label truncates there, and the hero chip
	 * above has already said what the number means.
	 */
	isCompact?: boolean;
	style?: StyleProp<ViewStyle>;
}
