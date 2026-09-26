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
	/**
	 * The group's seat count, which is what turns the loose pool babs into **blocks**. A seat
	 * offers its whole block or none of it, so the strip brackets them rather than leaving
	 * forty tan ticks looking like forty separate offers.
	 *
	 * Omit it — as the free reader does — and no brackets are drawn.
	 */
	spots?: number;
	/**
	 * The four-swatch key under the strip. On by default; the free reader turns it off, having
	 * nothing to key — every tick there means the same thing.
	 */
	hasLegend?: boolean;
	/**
	 * How many ticks the strip has — the Cevşen reader's hundred, or the Hizb reader's current
	 * section's block count, so one strip serves both texts. **With `spots`, it must be the
	 * group's part count**: the pool's blocks are cut from the seat split of exactly that many
	 * parts, and any other number would bracket the wrong ticks.
	 */
	count: number;
};
