import type { SegmentedControlProps } from './SegmentedControl.types';

/**
 * SwiftUI's own segmented picker, which is what earns the Liquid Glass treatment on iOS 26 —
 * the selected pill becomes the system material and morphs between segments rather than
 * cross-fading the way our drawn one does.
 *
 * **iOS only, by file extension.** `@expo/ui/swift-ui` resolves native views as its module
 * loads, so Metro must never reach this file on Android; the `.ios` suffix is what guarantees
 * that, not the runtime check that picks between the two.
 *
 * `pickerStyle('segmented')` is the whole trick. A SwiftUI `Picker` is a menu by default and
 * only becomes the segmented row with that modifier; each option is a `Text` carrying a `tag`,
 * and the tag is what `selection` matches against — so our string values pass straight through
 * and no call site learns that any of this happened.
 *
 * **Labels only.** SwiftUI takes an image per segment, but this bridge exposes `Text`
 * children, so `SegmentedControlOption.icon` is dropped here. That is why the appearance row's
 * sun and moon survive on Android and vanish on iOS.
 */

/*
 * **Required at run time, inside a `try`, rather than imported at the top.**
 *
 * `@expo/ui` is a native module, so a dev client built before it was added does not contain
 * `ExpoUI` — and `requireNativeView` throws the moment this module is evaluated. A static
 * import turns that into a redbox on every screen holding a segmented control: Profil,
 * "Yeni grup", the feedback sheet. Caught here it is merely a missing capability, and the
 * chooser falls back to the drawn control exactly as it does on Android.
 *
 * This is not only about the moment the dependency was added. Anyone who pulls the branch with
 * a stale build, or runs an older client against new JS, lands in the same place — and a
 * degraded control beats a crash every time.
 */
type SwiftUi = typeof import('@expo/ui/swift-ui');
type SwiftUiModifiers = typeof import('@expo/ui/swift-ui/modifiers');

let swiftUi: SwiftUi | null = null;
let modifiers: SwiftUiModifiers | null = null;

try {
	swiftUi = require('@expo/ui/swift-ui') as SwiftUi;
	modifiers = require('@expo/ui/swift-ui/modifiers') as SwiftUiModifiers;
} catch {
	swiftUi = null;
	modifiers = null;
}

/** Whether this build actually carries the SwiftUI bridge. Read by the chooser. */
export const isGlassSegmentedControlAvailable = swiftUi !== null && modifiers !== null;

export const GlassSegmentedControl = ({ onChange, options, style, value }: SegmentedControlProps) => {
	if (!swiftUi || !modifiers) {
		return null;
	}

	const { Host, Picker, Text } = swiftUi;
	const { pickerStyle, tag } = modifiers;

	return (
		/*
		 * `matchContents` so the SwiftUI view reports its own size back to Yoga. Without it the
		 * host lays out at zero height and the control is simply absent — nothing on screen and
		 * nothing in the logs.
		 */
		<Host matchContents style={style}>
			<Picker modifiers={[pickerStyle('segmented')]} onSelectionChange={onChange} selection={value}>
				{options.map(option => (
					<Text key={option.value} modifiers={[tag(option.value)]}>
						{option.label}
					</Text>
				))}
			</Picker>
		</Host>
	);
};
