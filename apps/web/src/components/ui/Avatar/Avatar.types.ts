import type { StyleProp, ViewStyle } from 'react-native';

export type AvatarTone = 'accent' | 'sand' | 'neutral';

export interface AvatarProps {
	name: string;
	size?: number;
	tone?: AvatarTone;
	style?: StyleProp<ViewStyle>;
}
