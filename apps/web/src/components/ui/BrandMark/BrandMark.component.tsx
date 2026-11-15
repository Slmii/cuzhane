import { Image } from 'react-native';
import type { BrandMarkProps } from './BrandMark.types';

/**
 * The gold rosette on its green disc — the app icon's own artwork, cut round. One file for every
 * place the mark is drawn (here, and the invite QR's centre), so it cannot drift from the icon.
 */
export const BRAND_ROSETTE = require('@/assets/brand/rosette.png');

export const BrandMark = ({ size = 44, style }: BrandMarkProps) => (
	<Image
		accessibilityIgnoresInvertColors
		fadeDuration={0}
		source={BRAND_ROSETTE}
		style={[{ height: size, width: size }, style]}
	/>
);
