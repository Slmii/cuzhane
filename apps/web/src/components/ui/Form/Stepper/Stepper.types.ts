import type { StyleProp, ViewStyle } from 'react-native';

export interface FormStepperProps {
	name: string;
	min?: number;
	max?: number;
	step?: number;
	caption?: string;
	style?: StyleProp<ViewStyle>;
}
