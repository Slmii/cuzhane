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
};

export interface SegmentProps {
	label: string;
	icon?: IconName;
	isSelected: boolean;
	onPress: () => void;
}

export interface SegmentedControlProps {
	options: SegmentedControlOption[];
	value: string;
	onChange: (value: string) => void;
	style?: StyleProp<ViewStyle>;
}
