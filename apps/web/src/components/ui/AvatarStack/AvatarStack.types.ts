import type { StyleProp, ViewStyle } from 'react-native';

export interface AvatarStackProps {
	names: string[];
	max?: number;
	size?: number;
	style?: StyleProp<ViewStyle>;
}
