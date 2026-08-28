import type { StyleProp, ViewStyle } from 'react-native';

export type AvatarTone = 'accent' | 'sand' | 'neutral';

export interface AvatarProps {
	name: string;
	/**
	 * The person's own photo, when there is one. The generated face is a stand-in for a
	 * picture, so a real picture always wins — someone who has set one expects to see it
	 * wherever they appear, not a drawing of a stranger.
	 */
	imageUrl?: string | null;
	size?: number;
	tone?: AvatarTone;
	style?: StyleProp<ViewStyle>;
}
