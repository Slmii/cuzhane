import type { StyleProp, ViewStyle } from 'react-native';

export interface GroupProgressSummaryProps {
	readCount: number;
	percent: number;
	style?: StyleProp<ViewStyle>;
}
