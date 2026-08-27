import type { StyleProp, ViewStyle } from 'react-native';

export interface HatchProps {
	/** Rounds the overlay to match the surface it sits on. */
	radius?: number;
	style?: StyleProp<ViewStyle>;
}
