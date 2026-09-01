import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

export type GlassSurfaceProps = {
	/**
	 * `'regular'` is the material for surfaces carrying controls — it keeps its own contrast
	 * against whatever passes beneath. `'clear'` is thinner and meant for surfaces over imagery,
	 * where the content below is the point.
	 */
	effect?: 'clear' | 'regular';
	/**
	 * Painted instead of the material wherever glass can't be used — Android, iOS before 26, and
	 * Reduce Transparency. Required, because a surface that silently vanishes on the platforms
	 * without glass is worse than one that never had it.
	 */
	fallbackColor: string;
	pointerEvents?: ViewProps['pointerEvents'];
	style?: StyleProp<ViewStyle>;
	/**
	 * Blended into the material, straight through to `UIGlassEffect.tintColor` — the glass keeps
	 * its blur and its specular edge and takes on this colour. Untinted, it samples whatever is
	 * behind it, which on a page whose background is already close to the surface colour leaves
	 * a panel barely distinguishable from the page. Pass the colour the surface used to be.
	 *
	 * Alpha is honoured, so it is also the strength control: a fully opaque colour reads almost
	 * like the flat fill, a translucent one lets more of the material through.
	 */
	tintColor?: string;
};
