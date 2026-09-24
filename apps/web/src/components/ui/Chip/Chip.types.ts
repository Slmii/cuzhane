import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * `accentOutline` is the ghost variant — accent hairline and text over no fill. It exists
 * so a second chip can sit beside a filled one (the "Kurucu" tag under a group's
 * visibility badge) without the two competing for the same emphasis.
 */
export type ChipTone = 'accent' | 'accentOutline' | 'missed' | 'sand' | 'neutral' | 'outline' | 'inverse';

export interface ChipProps {
	label: string;
	/**
	 * A glyph before the label, at the chip's own size and colour. The visibility badge uses
	 * it — a globe or a padlock says open-or-private at a glance, where two similar words set
	 * in the same small caps do not.
	 */
	icon?: IconName;
	/**
	 * A drawing before the label, for marks that are not icon-set glyphs — the reading-type
	 * marks, which are multi-path and carry their own palette. Sits where `icon` would.
	 */
	leading?: ReactNode;
	tone?: ChipTone;
	/** Filter chips render in the inverse tone when selected, ignoring `tone`. */
	isSelected?: boolean;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
}
