import type { StyleProp, ViewStyle } from 'react-native';

export type SelectOption = {
	label: string;
	value: string;
};

export interface FormSelectProps {
	name: string;
	options: SelectOption[];
	/**
	 * `chips` matches the design's cycle pills; `segmented` the settings toggles; `filled`
	 * the feedback sheet's topic row — equal thirds spanning the width, with the choice
	 * made by a solid accent fill rather than a tinted outline.
	 */
	variant?: 'chips' | 'segmented' | 'filled';
	error?: string;
	style?: StyleProp<ViewStyle>;
}
