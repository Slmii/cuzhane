import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StyleProp, ViewStyle } from 'react-native';

export type SegmentedControlOption = {
	label: string;
	value: string;
	/**
	 * A glyph before the label. The appearance row uses it — "Licht" and "Donker" are two
	 * words of the same weight in the same pill, and a sun against a moon is the part you can
	 * read without stopping. The language row deliberately has none: a flag or a globe beside
	 * "Türkçe" would say less than the word already does.
	 */
	icon?: IconName;
	/**
	 * Takes its label's whole width on one line before the rest share what is left — the
	 * repetition box's "Sayıyı gir" beside three short numbers. The drawn control only; the native
	 * one sizes its own segments.
	 */
	isWide?: boolean;
};

export interface SegmentProps {
	label: string;
	icon?: IconName;
	isWide?: boolean;
	fitsContent?: boolean;
	isSelected: boolean;
	onPress: () => void;
}

export interface SegmentedControlProps {
	options: SegmentedControlOption[];
	value: string;
	onChange: (value: string) => void;
	/**
	 * Each segment as wide as its label, the control hugging them — for a control beside a label
	 * in a row. Growing segments fill whatever room the row offers and run past its edge. The
	 * drawn control only; the native one is given a width.
	 */
	fitsContent?: boolean;
	style?: StyleProp<ViewStyle>;
}
