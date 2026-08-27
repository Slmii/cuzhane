import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ProgressRingProps {
	percent: number;
	size?: number;
	strokeWidth?: number;
	/** The unfilled circle behind the arc, if it should be thinner. Defaults to `strokeWidth`. */
	trackWidth?: number;
	/** Rendered centred inside the ring. */
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
}
