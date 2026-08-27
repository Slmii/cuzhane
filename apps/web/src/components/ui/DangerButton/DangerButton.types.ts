import type { StyleProp, ViewStyle } from 'react-native';

export interface DangerButtonProps {
	label: string;
	onPress: () => void;
	/** Filled with the danger colour instead of outlined — the armed half of a two-step. */
	isFilled?: boolean;
	/** Optional line under the button explaining what the action costs. */
	hint?: string;
	isDisabled?: boolean;
	style?: StyleProp<ViewStyle>;
}
