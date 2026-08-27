import type { StyleProp, ViewStyle } from 'react-native';

export interface OptionCardProps {
	title: string;
	hint?: string;
	isSelected: boolean;
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
}
