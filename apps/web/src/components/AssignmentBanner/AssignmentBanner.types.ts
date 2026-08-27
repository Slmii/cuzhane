import type { StyleProp, ViewStyle } from 'react-native';

export interface AssignmentBannerProps {
	/** Range shown in the badge, e.g. "1–5". */
	range: string;
	label: string;
	description: string;
	style?: StyleProp<ViewStyle>;
}
