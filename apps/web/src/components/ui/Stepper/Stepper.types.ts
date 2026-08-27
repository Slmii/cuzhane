import type { StyleProp, ViewStyle } from 'react-native';

export interface StepperProps {
	value: number;
	onChange: (next: number) => void;
	min?: number;
	max?: number;
	step?: number;
	caption?: string;
	style?: StyleProp<ViewStyle>;
}
