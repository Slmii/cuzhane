import { Icon } from '@/components/ui/Icon/Icon.component';
import { Platform, View } from 'react-native';
import type { SymbolIconProps } from './SymbolIcon.types';

type SwiftUi = typeof import('@expo/ui/swift-ui');
type SwiftUiModifiers = typeof import('@expo/ui/swift-ui/modifiers');

let swiftUi: SwiftUi | null = null;
let swiftUiModifiers: SwiftUiModifiers | null = null;

// Behind a `Platform` check as well as a `try` — see `DestructiveDialog` for why the check is
// the part that matters: the JavaScript resolves on Android too, only the native views don't.
if (Platform.OS === 'ios') {
	try {
		swiftUi = require('@expo/ui/swift-ui') as SwiftUi;
		swiftUiModifiers = require('@expo/ui/swift-ui/modifiers') as SwiftUiModifiers;
	} catch {
		swiftUi = null;
		swiftUiModifiers = null;
	}
}

/**
 * The icon set's own drawing, set as an SF Symbol where SwiftUI is drawing the neighbours.
 *
 * `scripts/build-symbols.mjs` turns a design-system SVG into a custom symbol in
 * `CuzhaneSymbols.xcassets`; this places one beside a glass control so the two glyphs are
 * rendered by the same engine at the same weight — a stroked `ui/Icon` next to a SwiftUI
 * symbol reads as two hands. Everywhere SwiftUI isn't available it is the ordinary `Icon`.
 *
 * A symbol added to the catalog reaches the app only through a native build (`expo prebuild`
 * copies the catalog; the app is then rebuilt). Until then the host draws nothing for it.
 */
export const SymbolIcon = ({
	assetName,
	color,
	icon,
	size,
	strokeWidth = 1.9,
	weight = 'semibold'
}: SymbolIconProps) => {
	if (!swiftUi || !swiftUiModifiers) {
		return <Icon color={color} name={icon} size={size} strokeWidth={strokeWidth} />;
	}

	const { Host, Image } = swiftUi;
	const { font } = swiftUiModifiers;

	return (
		// Sized here, not measured — the same reasoning as `GlassCornerAction`'s host.
		<View style={{ height: size, width: size }}>
			<Host ignoreSafeArea='keyboard' style={{ height: size, width: size }}>
				<Image assetName={assetName} color={color} modifiers={[font({ size, weight })]} />
			</Host>
		</View>
	);
};
