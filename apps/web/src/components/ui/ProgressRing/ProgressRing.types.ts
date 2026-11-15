import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ProgressRingProps {
	percent: number;
	size?: number;
	strokeWidth?: number;
	/** The unfilled circle behind the arc, if it should be thinner. Defaults to `strokeWidth`. */
	trackWidth?: number;
	/** The arc. Defaults to `accent`. */
	color?: string;
	/** The unfilled circle. Defaults to `secondary`. */
	trackColor?: string;
	/**
	 * A countdown rather than a reading of progress: it starts where it is instead of sweeping
	 * in, eases each step linearly over the second it ticks, and steps without easing under
	 * Reduce Motion.
	 */
	isTicking?: boolean;
	/** Rendered centred inside the ring. */
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
}
