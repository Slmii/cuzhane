import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface CardSurfaceProps {
	children: ReactNode;
	/** Removes the inner padding so rows can run edge-to-edge inside the card. */
	isFlush?: boolean;
	style?: StyleProp<ViewStyle>;
	onLongPress?: () => void;
	onPress?: () => void;
}
