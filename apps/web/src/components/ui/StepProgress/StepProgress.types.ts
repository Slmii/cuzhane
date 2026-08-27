import type { StyleProp, ViewStyle } from 'react-native';

export interface StepProgressProps {
	total: number;
	current: number;
	style?: StyleProp<ViewStyle>;
}
