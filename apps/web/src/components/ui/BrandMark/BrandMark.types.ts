import type { StyleProp, ViewStyle } from 'react-native';

export interface BrandMarkProps {
	/** Rendered edge length in points. The artwork is a square 100x100 viewBox. */
	size?: number;
	/** Overrides the mark's colours — e.g. drawn onto an accent tile. */
	color?: string;
	fadedColor?: string;
	style?: StyleProp<ViewStyle>;
}
