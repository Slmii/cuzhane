import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StyleProp, ViewStyle } from 'react-native';

export interface CornerActionProps {
	icon: IconName;
	/** Spoken label — the button is a glyph, so it has no visible text of its own. */
	accessibilityLabel: string;
	onPress: () => void;
	/**
	 * `accent` is the filled square — the primary action for the screen. `surface` is the
	 * outlined one that sits beside it when a heading carries two.
	 */
	tone?: 'accent' | 'surface';
	style?: StyleProp<ViewStyle>;
}
