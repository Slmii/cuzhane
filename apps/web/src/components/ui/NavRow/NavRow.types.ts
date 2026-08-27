import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface NavRowProps {
	label: string;
	meta?: string;
	onPress: () => void;
	leading?: ReactNode;
	style?: StyleProp<ViewStyle>;
}
