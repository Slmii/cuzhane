import type { StyleProp, ViewStyle } from 'react-native';

export interface ActivityHeatmapProps {
	days: { date: string; count: number }[];
	columns?: number;
	style?: StyleProp<ViewStyle>;
}
