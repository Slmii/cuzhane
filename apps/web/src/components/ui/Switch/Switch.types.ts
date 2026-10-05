import type { StyleProp, ViewStyle } from 'react-native';

/** Mirrors React Native's `Switch` contract so `Form/Switch` can wire it to a `Controller`. */
export interface AppSwitchProps {
	value: boolean;
	onValueChange: (value: boolean) => void;
	onBlur?: () => void;
	disabled?: boolean;
	/** The track while on, where the state has its own colour — live voice paused is sand. `accent` otherwise. */
	onColor?: string;
	style?: StyleProp<ViewStyle>;
}
