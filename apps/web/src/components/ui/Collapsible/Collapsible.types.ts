import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface CollapsibleProps {
	children: ReactNode;
	isOpen: boolean;
	style?: StyleProp<ViewStyle>;
}
