import type { StyleProp, ViewStyle } from 'react-native';

/**
 * `accentOutline` is the ghost variant — accent hairline and text over no fill. It exists
 * so a second chip can sit beside a filled one (the "Kurucu" tag under a group's
 * visibility badge) without the two competing for the same emphasis.
 */
export type ChipTone = 'accent' | 'accentOutline' | 'missed' | 'sand' | 'neutral' | 'outline' | 'inverse';

export interface ChipProps {
	label: string;
	tone?: ChipTone;
	/** Filter chips render in the inverse tone when selected, ignoring `tone`. */
	isSelected?: boolean;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
}
