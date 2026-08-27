import type { StyleProp, ViewStyle } from 'react-native';

export type SegmentedControlOption = {
	label: string;
	value: string;
};

export interface SegmentProps {
	label: string;
	isSelected: boolean;
	onPress: () => void;
}

export interface SegmentedControlProps {
	options: SegmentedControlOption[];
	value: string;
	onChange: (value: string) => void;
	style?: StyleProp<ViewStyle>;
}
