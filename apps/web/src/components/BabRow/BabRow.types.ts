import type { StyleProp, ViewStyle } from 'react-native';

export interface BabRowProps {
	title: string;
	subtitle: string;
	isRead: boolean;
	onToggle: () => void;
	onOpen: () => void;
	openLabel: string;
	style?: StyleProp<ViewStyle>;
}
