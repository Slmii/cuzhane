import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ToggleRowProps {
	title: string;
	hint?: string;
	/** Drawn in the same row under the title and hint — what the switch turns on, e.g. who it covers. */
	footer?: ReactNode;
	value: boolean;
	onValueChange: (value: boolean) => void;
	onBlur?: () => void;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
}
