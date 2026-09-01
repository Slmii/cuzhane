import { Icon } from '@/components/ui/Icon/Icon.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { GlassCornerActionProps } from './GlassCornerAction.types';

/**
 * A screen's whole-screen action as a toolbar item: **the glyph and nothing else** — no fill, no
 * material, no border, on either path. It sits in the navigator's bar beside the back button,
 * which is bare in the same way, so the row reads as one set of controls rather than as chips
 * dropped into a header.
 *
 * `ui/CornerAction` is not the fallback for that reason. That component is the design's 44pt
 * *square* with an accent or surface fill, which is right on a screen heading and wrong here;
 * the drawn path below is a bare `Pressable` around the same `ui/Icon`.
 *
 * **Our own glyphs where they have been converted.** A caller names an `assetName` — a custom
 * SF Symbol built from the design system's drawing by `scripts/build-symbols.mjs` — and falls
 * back to a stock `systemIcon` only for a glyph the icon set has no source for. The drawn path
 * always uses `ui/Icon`, so it is ours there regardless.
 *
 * Required in a `try` like every other `@expo/ui` surface: the package resolves native views as
 * it loads, so a client built before it was added would throw as this module is evaluated.
 */
type SwiftUi = typeof import('@expo/ui/swift-ui');
type SwiftUiModifiers = typeof import('@expo/ui/swift-ui/modifiers');

let swiftUi: SwiftUi | null = null;
let swiftUiModifiers: SwiftUiModifiers | null = null;

try {
	swiftUi = require('@expo/ui/swift-ui') as SwiftUi;
	swiftUiModifiers = require('@expo/ui/swift-ui/modifiers') as SwiftUiModifiers;
} catch {
	swiftUi = null;
	swiftUiModifiers = null;
}

/** The glyph's size. There is no shape around it on either path. */
const GLYPH_SIZE = 26;
/** The touch target the glyph sits in, on both paths — Apple's minimum, and a toolbar's rhythm. */
const TARGET_SIZE = 44;

export const GlassCornerAction = ({
	accessibilityLabel: label,
	assetName,
	icon,
	onPress,
	systemIcon,
	tone = 'accent'
}: GlassCornerActionProps) => {
	const { theme } = useThemeContext();
	const glyphColor = tone === 'accent' ? theme.colors.accent : theme.colors.text;

	/*
	 * **The fork is by platform, and by nothing else.** This used to bail out on
	 * `!isLiquidGlassSupported` and on Reduce Transparency, which was right while the button drew
	 * a `glass` disc and stopped being right the moment it went to `buttonStyle('plain')`: there
	 * is no material here to fall back from. Left in, the two guards sent iOS 18 and anyone with
	 * Reduce Transparency to the drawn path for no gain — losing the SF Symbol, the system's own
	 * press feedback and its hit-testing, to avoid a transparency the button never had.
	 *
	 * `isLiquidGlassSupported` still gates `ui/GlassSurface`, which really does draw a material.
	 * The test is what the component paints, not what its name suggests.
	 */
	if (Platform.OS !== 'ios' || !swiftUi || !swiftUiModifiers) {
		return (
			<Pressable
				accessibilityLabel={label}
				accessibilityRole='button'
				onPress={onPress}
				// The touch target the glyph does not fill on its own. Nothing is painted here.
				style={({ pressed }) => [styles.drawn, { opacity: pressed ? 0.6 : 1 }]}
			>
				<Icon color={glyphColor} name={icon} size={GLYPH_SIZE} strokeWidth={1.9} />
			</Pressable>
		);
	}

	const { Button, Host, Image } = swiftUi;
	const { accessibilityLabel, buttonStyle, controlSize, frame, tint } = swiftUiModifiers;

	return (
		/*
		 * **Sized here, not measured.** A `matchContents` Host reports 0×0 until its native view
		 * has laid out, and a header is measured to size the capsule it draws around its items —
		 * so on a screen being pushed the bar sized itself against nothing, then jumped once the
		 * Hosts came back. Going *back* looked right only because that header was still mounted
		 * from before and had measured long ago.
		 *
		 * There is nothing to measure anyway: the glyph's box is pinned to `TARGET_SIZE` by the
		 * `frame` modifier below, so declaring the same number on the React side makes the layout
		 * known on the first frame and skips the round trip entirely.
		 */
		<View style={styles.host}>
			<Host style={styles.host}>
				<Button
					modifiers={[
						/*
						 * **No background at all — the glyph and nothing else.** `glass` still
						 * draws a disc: over this app's flat page the material resolves to a pale
						 * panel, so the buttons read as chips rather than as bare controls.
						 * `plain` is SwiftUI's style with no chrome whatsoever, which is what a
						 * toolbar action is.
						 *
						 * No `buttonBorderShape` with it: there is no shape left to shape.
						 */
						buttonStyle('plain'),
						controlSize('regular'),
						/*
						 * **A 44pt box around a 19pt glyph.** `plain` draws no chrome, so the
						 * button hugged its symbol — which left the pair almost touching inside
						 * the capsule iOS groups them into, and gave each a 19pt touch target.
						 * The frame is what a toolbar item's spacing actually is: the items are
						 * 44 wide and sit flush, rather than being small glyphs pushed apart by
						 * a gap.
						 */
						frame({ height: TARGET_SIZE, width: TARGET_SIZE }),
						tint(glyphColor),
						accessibilityLabel(label)
					]}
					onPress={onPress}
				>
					{/* Ours if we have converted it, Apple's if we have not — see the types. */}
					<Image
						size={GLYPH_SIZE}
						{...(assetName === undefined ? { systemName: systemIcon } : { assetName })}
					/>
				</Button>
			</Host>
		</View>
	);
};

const styles = StyleSheet.create({
	/** The same box the `frame` modifier pins inside, declared where RN's layout can see it. */
	host: {
		height: TARGET_SIZE,
		width: TARGET_SIZE
	},
	drawn: {
		alignItems: 'center',
		height: TARGET_SIZE,
		justifyContent: 'center',
		width: TARGET_SIZE
	}
});
