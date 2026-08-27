import type { StyleProp, ViewStyle } from 'react-native';

export type SocialAuthProvider = 'google' | 'apple';

export interface SocialAuthButtonProps {
	provider: SocialAuthProvider;
	label: string;
	onPress: () => void;
	/** Half-width variant used on the sign-up screen's side-by-side row. */
	isCompact?: boolean;
	isLoading?: boolean;
	style?: StyleProp<ViewStyle>;
}
