import type { StyleProp, ViewStyle } from 'react-native';

export interface ToggleRowProps {
	title: string;
	hint?: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
	onBlur?: () => void;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
}
