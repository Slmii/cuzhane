import type { StyleProp, ViewStyle } from 'react-native';

export type OptionGroupItem = {
	value: string;
	title: string;
	hint?: string;
};

export interface FormOptionGroupProps {
	name: string;
	options: OptionGroupItem[];
	/** The design lays visibility side by side and split mode stacked. */
	direction?: 'row' | 'column';
	error?: string;
	style?: StyleProp<ViewStyle>;
}
