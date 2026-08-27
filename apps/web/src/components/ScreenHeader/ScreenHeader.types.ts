import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ScreenHeaderProps {
	title: string;
	subtitle?: string;
	/** Small caps line above the title — the pool screen's "ORTAK HAVUZ". */
	eyebrow?: string;
	/** Inline beside the title — the group screen's cycle chip on a daily group. */
	titleTrailing?: ReactNode;
	/** Far right of the heading row — the design's corner action, e.g. Paylaş. */
	action?: ReactNode;
	onBack?: () => void;
	style?: StyleProp<ViewStyle>;
}
