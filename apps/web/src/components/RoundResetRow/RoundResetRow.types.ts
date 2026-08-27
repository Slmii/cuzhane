import type { StyleProp, ViewStyle } from 'react-native';

export interface RoundResetRowProps {
	/** When the round rolls, in the group's own day — "Her gün 00:00 GMT+3". */
	groupLabel: string;
	/** The same moment where the reader is — "sende 18:00". */
	localLabel: string;
	/**
	 * `card` is the tighter treatment on a group card, where the two sit side by side with
	 * the local time in accent. `panel` is the group screen's stat card, where the group
	 * time leads in bold and the local time is pushed to the far edge.
	 */
	variant?: 'card' | 'panel';
	style?: StyleProp<ViewStyle>;
}
