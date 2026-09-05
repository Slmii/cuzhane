import type { StyleProp, ViewStyle } from 'react-native';

/** The bare artwork, for an SVG that already exists — the QR's emblem draws it on its plate. */
export interface BrandMarkGlyphProps {
	solidColor: string;
	fadedColor: string;
}

export interface BrandMarkProps {
	/** Rendered edge length in points. The artwork is a square 100x100 viewBox. */
	size?: number;
	/** Overrides the mark's colours — e.g. drawn onto an accent tile. */
	color?: string;
	fadedColor?: string;
	style?: StyleProp<ViewStyle>;
}
