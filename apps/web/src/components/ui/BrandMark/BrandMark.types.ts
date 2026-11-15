import type { ImageStyle, StyleProp } from 'react-native';

export interface BrandMarkProps {
	/** Rendered edge length in points. The artwork is round. */
	size?: number;
	style?: StyleProp<ImageStyle>;
}
