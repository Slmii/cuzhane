import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StyleProp, ViewStyle } from 'react-native';

export interface DangerButtonProps {
	label: string;
	/**
	 * A glyph before the label. The Icon Set names one "Ayrıl · Leave" and there is exactly
	 * one place to leave from, so the design drew it for this button.
	 */
	icon?: IconName;
	onPress: () => void;
	/** Filled with the danger colour instead of outlined — the armed half of a two-step. */
	isFilled?: boolean;
	/** Optional line under the button explaining what the action costs. */
	hint?: string;
	isDisabled?: boolean;
	style?: StyleProp<ViewStyle>;
}
