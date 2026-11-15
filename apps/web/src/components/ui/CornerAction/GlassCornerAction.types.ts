import type { CornerActionProps } from '@/components/ui/CornerAction/CornerAction.types';
import type { SFSymbol } from 'sf-symbols-typescript';

export interface GlassCornerActionProps extends Omit<CornerActionProps, 'style'> {
	/**
	 * What the glass path draws. `icon` is still required — it is what the drawn fallback
	 * renders, and on that path it is always our own `ui/Icon`.
	 *
	 * Prefer `assetName`: a custom SF Symbol built from the design system's own drawing by
	 * `scripts/build-symbols.mjs`, so the glyph is ours on both paths. `systemIcon` is the
	 * fallback for a glyph the icon set has no drawing for.
	 */
	assetName?: string;
	systemIcon?: SFSymbol;
	/**
	 * The bar is floating over a surface of its own — H1's coloured top layer, which is deep
	 * green in **both** themes. The glyph takes `onHeaderSurface` instead of following the
	 * theme's text colour, which in light mode is nearly the colour it would be sitting on.
	 */
	isOnHeaderSurface?: boolean;
	/**
	 * Draw the glass disc yourself. In a navigator's bar the header draws it around its items,
	 * so the button is a bare glyph; anywhere else (the search field's ×) there is no bar to
	 * do it, and this asks SwiftUI for the same `glass` style and circle the bar would give.
	 */
	hasOwnGlass?: boolean;
	/**
	 * A ripple spreads from under the glyph — Birlikte oku's button for as long as a session is
	 * live, on the live dot's beat. The same on both paths; never with Reduce Motion.
	 */
	isPulsing?: boolean;
}
