import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface StartedProgressProps {
	/** How far along, already worded: "Sayfa 22 / 41", "3 / 10 bab". */
	label: string;
	/** 0–100. */
	percent: number;
	/** Rows under the line — the Hizb's counters. */
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
}
