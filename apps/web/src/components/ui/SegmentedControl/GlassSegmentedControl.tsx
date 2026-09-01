import type { SegmentedControlProps } from './SegmentedControl.types';

/**
 * The platform's own segmented control, via `@expo/ui`'s drop-in replacement — a SwiftUI
 * `Picker` in the segmented style on iOS, which is what earns the Liquid Glass treatment on
 * 26: the selected pill becomes the system material and morphs between segments instead of
 * cross-fading the way our drawn one does.
 *
 * **Labels, not glyphs.** `SegmentedControlOption.icon` is dropped here, and that is a choice
 * rather than a limitation of this shim. Glyphs are reachable one layer down — `@expo/ui`'s
 * `Image` takes an SF Symbol or a local PNG, so the Icon Set's own sun and moon could be
 * rasterised the way the tab bar's are. What makes it not worth doing is UIKit: a segment
 * carries an image *or* a title, never both, because `setImage(_:forSegmentAt:)` clears any
 * title. The appearance row is "☀ Açık" / "☾ Koyu", and icon-only would trade two clear words
 * for two ambiguous pictures. Android keeps the drawn control and keeps both.
 *
 * The native module is required inside a `try` rather than imported at the top. `@expo/ui`
 * resolves native views as it loads, so a dev client built before it was added throws the
 * moment this module is evaluated — which would redbox every screen holding a segmented
 * control: Profil, "Yeni grup", the feedback sheet. Caught here it is merely a missing
 * capability, and the chooser falls back to the drawn control exactly as on Android. That is
 * not only about the moment this was added: anyone running new JS against an older build lands
 * in the same place, and a degraded control beats a crash every time.
 */
type ExpoSegmentedControl = typeof import('@expo/ui/community/segmented-control').SegmentedControl;

let NativeSegmentedControl: ExpoSegmentedControl | null = null;

try {
	NativeSegmentedControl = (
		require('@expo/ui/community/segmented-control') as {
			SegmentedControl: ExpoSegmentedControl;
		}
	).SegmentedControl;
} catch {
	NativeSegmentedControl = null;
}

/** Whether this build actually carries the native module. Read by the chooser. */
export const isGlassSegmentedControlAvailable = NativeSegmentedControl !== null;

export const GlassSegmentedControl = ({ onChange, options, style, value }: SegmentedControlProps) => {
	if (!NativeSegmentedControl) {
		return null;
	}

	/*
	 * The native control is index-based where ours is value-based, so the mapping lives here
	 * and no call site learns that any of this happened. Read back through
	 * `selectedSegmentIndex` rather than the `onValueChange` convenience prop, which hands
	 * back the *label* — not what the caller stores, and ambiguous if two options ever share
	 * one.
	 */
	const selectedIndex = options.findIndex(option => option.value === value);

	return (
		<NativeSegmentedControl
			onChange={event => {
				const next = options[event.nativeEvent.selectedSegmentIndex];

				if (next) {
					onChange(next.value);
				}
			}}
			selectedIndex={selectedIndex === -1 ? 0 : selectedIndex}
			style={style}
			values={options.map(option => option.label)}
		/>
	);
};
