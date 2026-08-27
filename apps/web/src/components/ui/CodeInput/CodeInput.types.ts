import type { StyleProp, ViewStyle } from 'react-native';

export interface CodeInputProps {
	value: string;
	length?: number;
	hasError?: boolean;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
}
