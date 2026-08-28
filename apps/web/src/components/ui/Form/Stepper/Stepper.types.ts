import type { StyleProp, ViewStyle } from 'react-native';

export interface FormStepperProps {
	name: string;
	min?: number;
	max?: number;
	step?: number;
	/** Allowed values, ascending — see `StepperProps.values`. */
	values?: number[];
	caption?: string;
	style?: StyleProp<ViewStyle>;
}
