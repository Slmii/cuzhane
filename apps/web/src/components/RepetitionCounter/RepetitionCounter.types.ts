import type { StyleProp, ViewStyle } from 'react-native';

export interface RepetitionCounterProps {
	/** The viewer's own count for the round shown. `undefined` until it has loaded — drawn as a dash. */
	count: number | undefined;
	/** How many make the portion markable — Sekine's nineteen. The counter never goes past it. */
	required: number;
	/**
	 * Called with the **absolute** count every time it changes — one up, one down, or a number
	 * picked from the sheet. The write it feeds is absolute for the same reason: a retried
	 * request then writes the same number twice instead of counting one recitation as two.
	 */
	onChange: (next: number) => void;
	/** Everything inert — before the count is known, or while the screen cannot say whose it is. */
	isDisabled?: boolean;
	style?: StyleProp<ViewStyle>;
}
