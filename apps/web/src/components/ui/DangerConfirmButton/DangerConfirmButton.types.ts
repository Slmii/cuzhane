import type { StyleProp, ViewStyle } from 'react-native';

export interface DangerConfirmButtonProps {
	/** Resting label — what the action is. */
	label: string;
	/** Second-tap label — the design phrases these as "Emin misin? Dokun ve …". */
	confirmLabel: string;
	onConfirm: () => void;
	/** Optional line under the button explaining what the action costs. */
	hint?: string;
	isDisabled?: boolean;
	style?: StyleProp<ViewStyle>;
}
