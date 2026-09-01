import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface CardSurfaceProps {
	children: ReactNode;
	/**
	 * Fills the card with iOS 26's glass instead of the flat `surface` token, falling back to
	 * that token wherever the material isn't available. Opt-in per card rather than the default,
	 * so cards elsewhere in the app are untouched.
	 */
	hasGlassSurface?: boolean;
	/** Removes the inner padding so rows can run edge-to-edge inside the card. */
	isFlush?: boolean;
	style?: StyleProp<ViewStyle>;
	onLongPress?: () => void;
	onPress?: () => void;
}
