import type { IconName } from '@/components/ui/Icon/Icon.types';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { Image as RNImage, StyleSheet } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { AppButtonProps, ButtonSize } from './Button.types';

/**
 * A SwiftUI `Button` wearing iOS 26's `.glass` style — the platform's own glass button rather
 * than one of ours with a material behind it. The style is `@expo/ui`'s `buttonStyle('glass')`,
 * which its own types mark as iOS 26+ only, so the caller must gate on
 * `isLiquidGlassSupported` as well as on `isGlassButtonAvailable` below.
 *
 * **This comes from `@expo/ui/swift-ui`, not the `community/*` drop-ins** the segmented control
 * and the reader's slider use. Those are thin shims over one control each; this is the full
 * SwiftUI bridge, where a view is composed from modifiers. The `universal` Button in the same
 * package has only `filled`/`outlined`/`text` and no glass at all.
 *
 * What it costs: the label is drawn in the system font rather than through `ui/Typography`. Our
 * `icon` crosses only where a stock SF Symbol stands in for it — see the map below — and a glyph
 * without one keeps the whole button on the drawn path. `variant` is not a cost at all.
 *
 * Required in a `try`, like `ui/SegmentedControl` and `GlassSizeSlider`: `@expo/ui` resolves
 * native views as it loads, so a client built before it was added throws as this module is
 * evaluated — which would redbox Profil rather than merely lose a style.
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

/**
 * Whether a glass button can actually render here: the OS has the style, and this build carries
 * the module. `AppButton` reads this to decide, so no screen has to.
 */
export const isGlassButtonAvailable = isLiquidGlassSupported && swiftUi !== null && swiftUiModifiers !== null;

/**
 * Where a native button's glyph comes from — **our own drawing wherever we have one.**
 *
 * `assetName` names a custom SF Symbol built from the design system's own SVG by EasySymbols,
 * which synthesises the full 9 weights × 3 optical scales from our centerline strokes. Those
 * live in `src/assets/symbols` and reach the app through the `withCustomSymbols` config plugin,
 * because `ios/` is generated and would otherwise lose them at every prebuild. The names are the
 * source filenames, so a glyph can be traced back to the drawing it came from.
 *
 * `systemName` is the fallback for a glyph we have no drawing for — Apple's nearest equivalent.
 *
 * **The two chevrons are a pair, and both are Apple's.** The icon folder has a right chevron and
 * a back *arrow*, but no left chevron — so `chevronLeft` had no drawing to use and `chevronRight`
 * did, which put a stock glyph opposite one of ours. Create-group's header sets them either side
 * of the same row, where the mismatch showed as two different button widths. Matching them at the
 * source is better than exempting one caller. The drawn path is unaffected: `ui/Icon` has both
 * chevrons and they were always a pair there.
 *
 * **Partial on purpose.** An icon with no entry sends the whole button back to the drawn path,
 * glyph intact — see `AppButton`. Losing a glyph is worse than losing a material, so silence is
 * never the answer; add an entry when a new icon turns up on a button.
 */
type GlyphSource = { assetName: string; systemName?: never } | { assetName?: never; systemName: SFSymbol };

const GLYPH_BY_ICON: Partial<Record<IconName, GlyphSource>> = {
	check: { assetName: 'tamam-check' },
	chevronLeft: { systemName: 'chevron.left' },
	// Apple's, like the chevrons: the icon set's own `kapat-close` converts fine, but a stock
	// mark keeps the three controls in create-group's header one family and one weight.
	close: { systemName: 'xmark' },
	chevronRight: { systemName: 'chevron.right' },
	copy: { assetName: 'kopyala-copy-link' },
	// Ours, converted like the tick it sits opposite in Yönet — Apple's own `trash` is drawn to
	// the full box the converted glyphs leave room in, so at one point size it came out visibly
	// heavier than the tick.
	delete: { assetName: 'sil-delete' },
	leave: { assetName: 'ayril-leave' },
	// Q4's "Uygulamada oku" — converted so the button takes the same capsule as Okudum.
	readInApp: { assetName: 'uygulamada-oku-read-in-app' },
	// Beside it on Q4 — the frame's hand-over card, converted the same way.
	handOver: { assetName: 'devret-hand-over' },
	search: { assetName: 'ara-search' },
	/*
	 * **Converted because its own other half already was.** The pool's one button says
	 * "Üstlen" or "Geri al" depending on state, and `undo` had an entry while `claim` did
	 * not — so the same control rendered glass one way and drawn the other, which is the
	 * `delete`-beside-`check` mismatch in Yönet all over again. An icon with no entry sends
	 * the whole button back to the drawn path, silently.
	 */
	claim: { assetName: 'ustlen-claim' },
	undo: { assetName: 'geri-al-undo' },
	// The cüz reader's "Kaldığım yeri işaretle" — the set's own bookmark, converted, so the button
	// is one glyph on both platforms instead of Apple's `bookmark` on iOS and nothing elsewhere.
	bookmark: { assetName: 'kaldigin-yer-bookmark' }
};

/** Whether this glyph can cross to a native button. `AppButton` asks before switching paths. */
export const hasSfSymbol = (icon: IconName) => GLYPH_BY_ICON[icon] !== undefined;

/** Our three sizes against SwiftUI's, which owns the metrics once the button is native. */
const CONTROL_SIZE_BY_SIZE: Record<ButtonSize, 'small' | 'regular' | 'large'> = {
	sm: 'small',
	md: 'regular',
	lg: 'large'
};

/**
 * **A mirror of `iconSizeMap` in `Button.component.tsx` — change both together.**
 *
 * Left to itself an SF Symbol sizes off the label's font, which came out visibly larger than the
 * drawn button's glyph and made the same button look like two different controls depending on
 * the platform. These are the drawn button's own numbers, a shade above the label so the glyph
 * reads as its equal rather than as punctuation.
 *
 * The map cannot simply be imported: `Button.component.tsx` already imports this module, and
 * reaching back the other way would close the cycle.
 */
const ICON_SIZE_BY_SIZE: Record<ButtonSize, number> = {
	sm: 13,
	md: 14,
	lg: 15
};

/**
 * **A glyph on its own is the navigation bar's disc**, whatever `size` says: SwiftUI's `large`
 * control in a circle — the 44pt the bar gives its back chevron — with the glyph at 20pt
 * semibold, which is how that chevron is set. Create-group's × and ✓, the reader's arrows and
 * the search field's × all read as the same control as the bar's, instead of three sizes of a
 * different one. Mirrored by `ICON_ONLY_SIZE` / `ICON_ONLY_GLYPH_SIZE` in `Button.component.tsx`
 * for the drawn path, and by `GlassCornerAction`'s own-glass variant.
 */
const ICON_ONLY_GLYPH_SIZE = 20;

/**
 * **A mirror of `labelSizeStyleMap` in `Button.component.tsx` — change both together.**
 *
 * A SwiftUI `Text` is 17pt unless told otherwise, and `controlSize` moves the button's padding
 * rather than its type. Left at that default the same button read 17pt on iOS 26 and 13.5pt
 * everywhere else — and it threw the glyph off too: `ICON_SIZE_BY_SIZE` is tuned a shade *above*
 * the drawn label, so beside a 17pt one the icon ended up below it instead. Taking the drawn
 * button's own sizes fixes both, and there is no size left to special-case.
 *
 * Naming a size opts out of Dynamic Type, which is parity rather than a loss: the drawn
 * button's `fontSize` is fixed too, so neither scales and the two stay identical.
 */
const LABEL_SIZE_BY_SIZE: Record<ButtonSize, number> = {
	sm: 12,
	md: 12.5,
	lg: 13.5
};

/**
 * SwiftUI's `.infinity`, as a number the bridge can carry. `maxWidth` is typed as a plain
 * number and JSON has no infinity, so the idiom is a value no layout will ever reach.
 */
const FULL_WIDTH = 10_000;

export const GlassButton = ({
	accessibilityLabel,
	disabled = false,
	fullWidth = true,
	icon,
	iconPosition = 'leading',
	onPress,
	size = 'lg',
	imageIcon,
	style,
	systemIcon,
	title,
	variant = 'primary'
}: Pick<
	AppButtonProps,
	| 'accessibilityLabel'
	| 'disabled'
	| 'fullWidth'
	| 'icon'
	| 'iconPosition'
	| 'imageIcon'
	| 'onPress'
	| 'size'
	| 'style'
	| 'systemIcon'
	| 'title'
	| 'variant'
>) => {
	const { theme } = useThemeContext();

	if (!swiftUi || !swiftUiModifiers) {
		return null;
	}

	const { Button, HStack, Host, Image, Text } = swiftUi;
	const {
		accessibilityLabel: accessibilityLabelModifier,
		buttonBorderShape,
		buttonStyle,
		controlSize,
		disabled: disabledModifier,
		font,
		frame,
		resizable,
		tint
	} = swiftUiModifiers;
	/*
	 * **`systemIcon` wins where it is given, and that is a deliberate override.**
	 *
	 * It used to be consulted only in the absence of an `icon`, on the reasoning that our own
	 * drawing works everywhere and a stock symbol does not. That is right for a *fallback* and
	 * wrong for a caller naming both: passing the pair says "Apple's on the glass path, ours when
	 * this is drawn", which is the only way to ask for a stock glyph on iOS and keep the icon set
	 * on Android. Create-group's header wants exactly that — its tick has to be the same width as
	 * the chevron facing it, and a hugging glass button is as wide as whatever it holds.
	 *
	 * A caller with no `icon` at all still gets the stock symbol on glass and nothing drawn, which
	 * is what Apple's logo on the sign-in button needs.
	 */
	/*
	 * **Artwork resolves to a file URI, which is the only way a brand mark crosses.** `Image`
	 * takes `uiImage` — a path on disk — so a bundled PNG has to be turned into one.
	 * `resolveAssetSource` does that for a `require`d asset, and it is what RN's own `<Image>`
	 * uses underneath.
	 *
	 * In a release build that is a file inside the bundle. Under Metro it is an `http` URL, and
	 * whether SwiftUI will load one is the part to watch: if it doesn't, the button shows its
	 * label alone in development and the mark is back in the shipped app. Losing it *always*
	 * would mean falling back to the drawn button, which is the rule everywhere else — here the
	 * material is worth more, because this glyph is decoration beside a word that already says
	 * "Google".
	 */
	const imageUri = imageIcon === undefined ? undefined : RNImage.resolveAssetSource(imageIcon)?.uri ?? undefined;

	const glyph: GlyphSource | undefined =
		systemIcon !== undefined ? { systemName: systemIcon } : icon !== undefined ? GLYPH_BY_ICON[icon] : undefined;
	// A glyph and no word — the bar's disc, see `ICON_ONLY_GLYPH_SIZE`.
	const isIconOnly = title === undefined && (imageUri !== undefined || glyph !== undefined);
	// Built once so the two sides of the label can place the same element. One source or the
	// other, never both — `GlyphSource` makes that a type error.
	const glyphImage =
		imageUri !== undefined ? (
			/*
			 * **`size` does not apply here** — it is documented as the size of a *system* image,
			 * so artwork ignored it and drew at its own, which put a 48px mark beside a 13.5pt
			 * word. A SwiftUI `Image` also holds its intrinsic size until told it may scale, so
			 * `resizable` has to come before the frame or the frame is just a box it overflows.
			 * `ICON_SIZE_BY_SIZE` is the same map the SF Symbols and the drawn glyphs use, so all
			 * three land at one size.
			 */
			<Image
				modifiers={[
					resizable(),
					frame(
						isIconOnly
							? { height: ICON_ONLY_GLYPH_SIZE, width: ICON_ONLY_GLYPH_SIZE }
							: { height: ICON_SIZE_BY_SIZE[size], width: ICON_SIZE_BY_SIZE[size] }
					)
				]}
				uiImage={imageUri}
			/>
		) : glyph === undefined ? null : (
			<Image
				// The font modifier replaces `size`, and it is the only way to name a weight.
				{...(isIconOnly
					? { modifiers: [font({ size: ICON_ONLY_GLYPH_SIZE, weight: 'semibold' })] }
					: { size: ICON_SIZE_BY_SIZE[size] })}
				{...(glyph.assetName === undefined ? { systemName: glyph.systemName } : { assetName: glyph.assetName })}
			/>
		);

	/*
	 * **Our own typeface, not the system's.** `font`'s `family` maps to SwiftUI's
	 * `Font.custom`, which resolves a font registered with the system by name — and
	 * `expo-font` registers ours at launch under exactly these keys. The native tab bar
	 * already proves the round trip: it draws its labels in `appFonts.medium` through
	 * `tabLabelStyle`. The weight comes from the family rather than a `weight` argument,
	 * because a custom font carries its own.
	 *
	 * The size comes from `LABEL_SIZE_BY_SIZE`, which is the drawn button's own map — so the two
	 * render the same words at the same size in the same face.
	 */
	const labelModifiers = [font({ family: appFonts.semibold, size: LABEL_SIZE_BY_SIZE[size] })];

	/*
	 * **`tint` colours the label on `glass` and the fill on `glassProminent`.** That one
	 * difference is what lets our variants survive the crossing: the three that are filled when
	 * drawn ask for the prominent style and hand it the same token, and the three that aren't
	 * stay on plain glass. So a danger button is still red and a primary one still near-black,
	 * rather than every variant arriving as the same neutral pill.
	 *
	 * `ghost` and `surface` pass no tint at all — their drawn selves have no fill either, and
	 * naming a colour would invent one.
	 *
	 * Which is also why `danger` sits with the *outlined* group and `dangerFilled` with the
	 * filled one: drawn, `danger` is a hairline over `surface`, so the prominent style would have
	 * given it a fill the platform version never had.
	 */
	/**
	 * A `width`/`height` pair from the caller's `style`, to be re-stated as a SwiftUI `frame` —
	 * see the modifier below. Both or neither: a half-given size would let one axis hug and the
	 * other be pinned, which is worse than either.
	 */
	const flatStyle = StyleSheet.flatten(style) ?? {};
	const fixedSize =
		typeof flatStyle.height === 'number' && typeof flatStyle.width === 'number'
			? { height: flatStyle.height, width: flatStyle.width }
			: null;

	const glassToneByVariant = {
		primary: { style: 'glassProminent', tintColor: theme.colors.primary },
		accent: { style: 'glassProminent', tintColor: theme.colors.accent },
		dangerFilled: { style: 'glassProminent', tintColor: theme.colors.danger },
		accentOutline: { style: 'glass', tintColor: theme.colors.accent },
		outline: { style: 'glass', tintColor: undefined },
		danger: { style: 'glass', tintColor: theme.colors.danger },
		surface: { style: 'glass', tintColor: undefined },
		ghost: { style: 'glass', tintColor: undefined }
	}[variant] as { style: 'glass' | 'glassProminent'; tintColor: string | undefined };

	return (
		/*
		 * **`fullWidth` decides where the width comes from, and it has to.** A full-width button
		 * takes its width from the column it sits in and stretches the label to fill it. One that
		 * hugs cannot do that: the six call sites passing `fullWidth={false}` sit in flex rows —
		 * `GroupCard`'s "Katıl" beside its member count, the pool screen's pair — where nothing
		 * constrains width, and a host waiting to be told one collapses to nothing. That is the
		 * same failure the appearance segmented control had. Measuring horizontally as well lets
		 * the button report its own size the way the drawn one does.
		 *
		 * `matchContents` is read once on mount, which is fine — no call site changes `fullWidth`.
		 */
		<Host
			// A SwiftUI host dodges the keyboard on its own; the React layout around it
			// already does, and a button that does both climbs off its row.
			ignoreSafeArea='keyboard'
			matchContents={fullWidth ? { vertical: true } : { horizontal: true, vertical: true }}
			style={[fullWidth ? styles.stretch : null, style]}
		>
			<Button
				modifiers={[
					buttonStyle(glassToneByVariant.style),
					// The glass style sizes its disc from the control size: `large` is the bar's 44.
					controlSize(isIconOnly ? 'large' : CONTROL_SIZE_BY_SIZE[size]),
					disabledModifier(disabled),
					/*
					 * **One shape for a pinned pair.** `glass` defaults to a capsule and
					 * `glassProminent` to a rounded rectangle, so a filled button set beside an
					 * outlined one is a different silhouette at the same size. Saying the shape
					 * lets create-group's header put a sage tick opposite a plain chevron without
					 * the two reading as unrelated controls.
					 */
					...(isIconOnly
						? [buttonBorderShape('circle')]
						: fixedSize === null
						? []
						: [buttonBorderShape('capsule')]),
					/*
					 * A surface disc holding only a glyph is tinted with the text colour, as the
					 * bar tints its back chevron: untinted, SwiftUI falls back to the app's accent,
					 * which paints the glyph sage and leaves the glass a duller rim than the bar's.
					 */
					...(glassToneByVariant.tintColor !== undefined
						? [tint(glassToneByVariant.tintColor)]
						: isIconOnly
						? [tint(theme.colors.text)]
						: []),
					// SwiftUI takes this as a modifier where the drawn button takes it as a prop.
					...(accessibilityLabel === undefined ? [] : [accessibilityLabelModifier(accessibilityLabel)])
				]}
				onPress={onPress}
			>
				{/*
				 * **The width goes on the label, not on the button.** A `Button` is sized by its
				 * label, and `.glass` draws its capsule around whatever that comes out as — so
				 * widening the button itself left the glass still hugging the words and put a
				 * small pill where a full-width button belongs. Stretching the `Text` is what
				 * SwiftUI expects, and the background follows it.
				 *
				 * `children` rather than the `label` prop, because only a child view can carry
				 * modifiers of its own — and, once there is a glyph, because `systemImage` is
				 * documented as working *only* alongside `label`, which we cannot use. Composing
				 * the row by hand is what lets the button have both an icon and a stretched label.
				 *
				 * **With a glyph the stretch moves to the row, not the label.** Stretching the
				 * `Text` made it eat the width and shove the glyph against the button's edge, half
				 * a button away from the word it belongs to. Stretching the `HStack` instead
				 * fills the same space and centres its contents, so the pair reads as one thing —
				 * which is what the drawn button has always done. `spacing` is its `gap: 8`.
				 */}
				{glyphImage !== null && title === undefined ? (
					// Glyph only — the reader's arrows. No `HStack` and no `Text`: an empty one
					// still takes a line's height and would make the button taller than its glyph.
					// A SwiftUI `Button` takes no null child, hence the glyph test before the
					// label test; `AppButtonProps` already rules out having neither.
					//
					// **A pinned size goes here, on the label.** `.glass` draws its capsule around
					// the *label*, which is the same reason `fullWidth` stretches the `Text` rather
					// than the button — a frame on the `Button` sized the box and left the capsule
					// still hugging the glyph, so the two ends of a row stayed different widths.
					fixedSize === null ? (
						glyphImage
					) : (
						<HStack modifiers={[frame(fixedSize)]}>{glyphImage}</HStack>
					)
				) : glyphImage === null ? (
					<Text modifiers={fullWidth ? [...labelModifiers, frame({ maxWidth: FULL_WIDTH })] : labelModifiers}>
						{title}
					</Text>
				) : (
					<HStack modifiers={fullWidth ? [frame({ maxWidth: FULL_WIDTH })] : []} spacing={8}>
						{iconPosition === 'trailing' ? null : glyphImage}
						<Text modifiers={labelModifiers}>{title}</Text>
						{iconPosition === 'trailing' ? glyphImage : null}
					</HStack>
				)}
			</Button>
		</Host>
	);
};

const styles = StyleSheet.create({
	stretch: {
		alignSelf: 'stretch'
	}
});
