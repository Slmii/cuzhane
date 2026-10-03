/** The design's `meter()`: each bar's cycle and where in it the bar starts (negative: mid-cycle), in ms. */
const DURATIONS_MS = [1050, 1400, 900, 1250];
const DELAYS_MS = [0, -350, -700, -200];
/** How far each bar reaches, after the design's still shape: the second highest, the fourth least. */
const WEIGHTS = [0.85, 1.15, 1, 0.8];
/** How much of a bar's reach its own cycle takes away at the cycle's low point. */
const SWAY = 0.4;

/** `ses-lv`'s low point: the bars at rest, in silence. */
export const METER_REST = 0.32;
/** Reduce Motion: the design's still shape. */
export const METER_STILL = [0.45, 0.9, 0.62, 0.36];

/**
 * **The four bars' heights (scaleY) for a loudness** (0 to 1, `loudnessOf`) at a moment. Silence
 * rests every bar at `METER_REST`; a voice lifts them by its loudness, each by its own weight and
 * swaying on its own `ses-lv` cycle, so speech reads as the design's wave rather than four bars
 * moving as one.
 */
export const meterScales = (loudness: number, nowMs: number) =>
	DURATIONS_MS.map((duration, index) => {
		const phase = (((nowMs - (DELAYS_MS[index] ?? 0)) % duration) + duration) % duration;
		// 0 at the cycle's start and end, 1 halfway — `ses-lv`'s 0% / 50% / 100%.
		const wave = 0.5 - 0.5 * Math.cos((2 * Math.PI * phase) / duration);
		const reach = Math.min(1, Math.max(0, loudness) * (WEIGHTS[index] ?? 1) * (1 - SWAY + SWAY * wave));

		return METER_REST + (1 - METER_REST) * reach;
	});
