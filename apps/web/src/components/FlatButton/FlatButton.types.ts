import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * `ink` — the one dark button of a card (R1's "Uygulamada oku", R4's "Kitaptan okudum").
 * `muted` — its grey partner (R1's "Kitaptan okudum").
 * `accent` — T1d's "+ Bir tekrar".
 * `link` — R4's "Uygulamada oku": accent text, no fill.
 */
export type FlatButtonVariant = 'ink' | 'muted' | 'accent' | 'link';

export interface FlatButtonProps {
	title: string;
	onPress: () => void;
	variant: FlatButtonVariant;
	icon?: IconName;
	disabled?: boolean;
	accessibilityLabel?: string;
	style?: StyleProp<ViewStyle>;
}
