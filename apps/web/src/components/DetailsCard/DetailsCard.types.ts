import type { StyleProp, ViewStyle } from 'react-native';

export interface DetailsCardRow {
	label: string;
	value: string;
}

export interface DetailsCardProps {
	rows: DetailsCardRow[];
	style?: StyleProp<ViewStyle>;
}
