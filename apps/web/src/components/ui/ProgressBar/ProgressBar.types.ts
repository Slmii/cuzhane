import type { StyleProp, ViewStyle } from 'react-native';

export interface ProgressBarProps {
	percent: number;
	/** What the bar measures, for a screen reader — the role and the value are set here already. */
	accessibilityLabel?: string;
	height?: number;
	trackColor?: string;
	fillColor?: string;
	style?: StyleProp<ViewStyle>;
}
