import type { StyleProp, ViewStyle } from 'react-native';

export interface ProgressBarProps {
	percent: number;
	height?: number;
	trackColor?: string;
	fillColor?: string;
	style?: StyleProp<ViewStyle>;
}
