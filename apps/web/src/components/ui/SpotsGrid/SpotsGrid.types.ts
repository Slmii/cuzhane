import type { StyleProp, ViewStyle } from 'react-native';

export interface SpotsGridProps {
	total: number;
	filled: number;
	columns?: number;
	style?: StyleProp<ViewStyle>;
}
