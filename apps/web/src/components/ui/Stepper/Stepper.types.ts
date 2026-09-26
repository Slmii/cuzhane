import type { StyleProp, ViewStyle } from 'react-native';

export interface StepperProps {
	value: number;
	onChange: (next: number) => void;
	min?: number;
	max?: number;
	step?: number;
	/**
	 * The allowed values, ascending. When given, +/- walk this list instead of adding `step`,
	 * and `min`/`max`/`step` are ignored — a set like 5, 10, 20 isn't an arithmetic sequence,
	 * so a stepper that could only add a constant would stop at values nothing accepts.
	 */
	values?: readonly number[];
	caption?: string;
	style?: StyleProp<ViewStyle>;
}
