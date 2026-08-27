import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * `accentOutline` is the accent hairline over no fill — the round detail's "Üstlen",
 * which sits beside a filled "Okudum" and must read as the lesser of the two claims.
 */
export type ButtonVariant = 'primary' | 'accent' | 'accentOutline' | 'surface' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
	onPress: () => void;
	title: string;
	/**
	 * Optional glyph before the label — the tick on a "copied" / "pasted" confirmation.
	 * Hidden while loading, since the spinner replaces the whole content.
	 */
	icon?: IconName;
	variant?: ButtonVariant;
	size?: ButtonSize;
	style?: StyleProp<ViewStyle>;
	disabled?: boolean;
	fullWidth?: boolean;
	isLoading?: boolean;
}
