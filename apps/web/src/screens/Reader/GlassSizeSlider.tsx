import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useRef } from 'react';
import type { ReaderSizeSliderProps } from './ReaderSizeSlider.types';

/**
 * The platform's own slider, via `@expo/ui`'s drop-in replacement — a SwiftUI `Slider`, whose
 * knob iOS 26 renders in Liquid Glass while a finger is on it. That transformation is the
 * whole reason to hand the control over; a drawn knob is a circle for ever.
 *
 * **Only the active track is tinted, and that is the platform's decision rather than ours.**
 * SwiftUI's `Slider` exposes `.tint()` for the filled side alone; `@expo/ui` accepts
 * `thumbTintColor` and `maximumTrackTintColor` at the type level and never applies them on
 * iOS. That happens to be exactly right — naming a thumb colour is what flattens a glass knob
 * into a solid disc, the lesson `ui/Switch` records — so the knob stays the system's.
 * `maximumTrackTintColor` is passed anyway for the platforms that do honour it.
 *
 * The native module is required inside a `try`: `@expo/ui` resolves native views as it loads,
 * so a client built before it was added would throw as this module is evaluated and redbox the
 * reader's settings sheet. Caught here it is a missing capability, and the caller falls back
 * to the drawn slider exactly as on Android.
 */
type ExpoSlider = typeof import('@expo/ui/community/slider').Slider;

let NativeSlider: ExpoSlider | null = null;

try {
	NativeSlider = (require('@expo/ui/community/slider') as { Slider: ExpoSlider }).Slider;
} catch {
	NativeSlider = null;
}

/** Whether this build actually carries the native module. Read by the caller. */
export const isGlassSizeSliderAvailable = NativeSlider !== null;

/**
 * How long after the last movement the size is written.
 *
 * **The native slider reports movement but never release** — `onValueChange` and nothing
 * else — so there is no moment to hang the save on the way the drawn one hangs it on
 * `onFinalize`. Persisting every frame would be a request per pixel, which is exactly what
 * the drawn slider's two-callback split exists to avoid, so a debounce stands in for the
 * release. Long enough to sit out a drag, short enough that letting go feels like saving.
 * The same shape the reminder time picker uses for the same reason.
 */
const COMMIT_DELAY_MS = 400;

export const GlassSizeSlider = ({ max, min, onChange, onDraft, value }: ReaderSizeSliderProps) => {
	const { theme } = useThemeContext();
	const commitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pending = useRef<number | null>(null);

	/*
	 * **Held in a ref, and the flush below depends on nothing.**
	 *
	 * `ReaderSettings` passes `onChange` as an inline arrow, so its identity changes every
	 * render. With `[onChange]` on the effect below, the cleanup ran on *every* render rather
	 * than on unmount — and since that cleanup commits any pending value, it called `onChange`,
	 * which re-rendered the parent, which minted another arrow, which ran the cleanup again.
	 * React caught it as "Maximum update depth exceeded". The ref keeps the callback current
	 * without making the effect depend on it.
	 */
	const onChangeRef = useRef(onChange);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	/*
	 * Flushed on unmount, so closing the sheet mid-drag still saves. A debounce lives in a JS
	 * timer and a timer dies with its component; without this, the size you left the knob at
	 * would be previewed and then quietly lost.
	 */
	useEffect(
		() => () => {
			if (commitTimeout.current) {
				clearTimeout(commitTimeout.current);

				if (pending.current !== null) {
					onChangeRef.current(pending.current);
				}
			}
		},
		// Mount and unmount only — see the ref above. Naming `onChange` here is what looped.
		[]
	);

	if (!NativeSlider) {
		return null;
	}

	const handleChange = (next: number) => {
		const size = Math.round(next);

		onDraft(size);
		pending.current = size;

		if (commitTimeout.current) {
			clearTimeout(commitTimeout.current);
		}

		commitTimeout.current = setTimeout(() => {
			commitTimeout.current = null;
			pending.current = null;
			onChangeRef.current(size);
		}, COMMIT_DELAY_MS);
	};

	return (
		<NativeSlider
			maximumTrackTintColor={theme.colors.switchTrackOff}
			maximumValue={max}
			minimumTrackTintColor={theme.colors.accent}
			minimumValue={min}
			onValueChange={handleChange}
			step={1}
			value={value}
		/>
	);
};
