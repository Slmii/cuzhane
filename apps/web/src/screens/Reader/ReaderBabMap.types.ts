import type { SharedValue } from 'react-native-reanimated';

export type ReaderBabMapProps = {
	/**
	 * Where the reader is when nobody is dragging. Only the resting position — while a drag
	 * is live `scrubRatio` wins, so this does not change per frame.
	 */
	currentBab: number;
	/**
	 * The drag's position along the strip, 0–1, or `-1` when nobody is dragging.
	 *
	 * The indicator rides this on the UI thread. Without it the current position was part of
	 * the tick list, so every bab the finger crossed re-rendered a hundred views — measured
	 * off a screen recording, that left 44% of frames pixel-identical to the one before and
	 * stalls of ~120ms.
	 */
	scrubRatio: SharedValue<number>;
	/**
	 * Read this round, whoever read it. These three must keep **stable identities** across
	 * renders or the tick list re-renders anyway and the split above buys nothing.
	 */
	readBabNumbers: number[];
	myBabNumbers: number[];
	poolBabNumbers: number[];
};
