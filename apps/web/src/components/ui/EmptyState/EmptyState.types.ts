import type { StyleProp, ViewStyle } from 'react-native';

export interface EmptyStateProps {
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
	style?: StyleProp<ViewStyle>;
}
