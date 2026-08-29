import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withTiming
} from 'react-native-reanimated';
import type { ShelfMarkProps } from './ShelfMark.types';

/** The design's five columns, at the splash's scale. */
const COLUMNS = [60, 76, 68, 84, 72];
/** The trailing two are what hasn't been read yet — dimmed, not missing. */
const DIM_FROM_INDEX = 3;
const GROW_MS = 620;
const STEP_MS = 80;

type ColumnProps = {
	color: string;
	delay: number;
	height: number;
	shouldAnimate: boolean;
	width: number;
};

/**
 * One column, growing from the shelf up the way a stack fills.
 *
 * A shared value each rather than one driving all five: `withDelay` belongs to the
 * animation, not to the reader of it, and five mappers on a splash that runs once is not
 * the per-cell cost the boards have to avoid.
 */
const Column = ({ color, delay, height, shouldAnimate, width }: ColumnProps) => {
	const grow = useSharedValue(shouldAnimate ? 0 : 1);

	useEffect(() => {
		if (!shouldAnimate) {
			return;
		}

		grow.value = withDelay(delay, withTiming(1, { duration: GROW_MS, easing: Easing.bezier(0.2, 0.9, 0.25, 1) }));
	}, [delay, grow, shouldAnimate]);

	const columnStyle = useAnimatedStyle(() => ({
		opacity: grow.value,
		transform: [{ scaleY: 0.06 + grow.value * 0.94 }]
	}));

	return (
		<Animated.View
			style={[{ backgroundColor: color, borderRadius: width / 2, height, width }, styles.column, columnStyle]}
		/>
	);
};

/**
 * The logo: bars standing on a shelf.
 *
 * Bars and shelf are **one group** — the shelf is a solid bar spanning the mark's width
 * rather than a rule beneath it, and only the trailing columns are dimmed. Drawn rather
 * than shipped as an asset so it can animate and take the colour around it.
 */
export const ShelfMark = ({ color, dimColor, scale = 1, shouldAnimate = true }: ShelfMarkProps) => {
	const isReducedMotion = useReducedMotion();
	const isAnimated = shouldAnimate && !isReducedMotion;

	return (
		<View style={[styles.root, { gap: 4 * scale }]}>
			<View style={[styles.bars, { gap: 5 * scale, height: 88 * scale }]}>
				{COLUMNS.map((height, index) => (
					<Column
						color={index >= DIM_FROM_INDEX ? dimColor : color}
						delay={index * STEP_MS}
						height={height * scale}
						key={`${height}-${index}`}
						shouldAnimate={isAnimated}
						width={14 * scale}
					/>
				))}
			</View>
			{/* The shelf: solid, full width, never dimmed. */}
			<View style={{ backgroundColor: color, borderRadius: 4 * scale, height: 7 * scale, width: 90 * scale }} />
		</View>
	);
};

const styles = StyleSheet.create({
	bars: {
		alignItems: 'flex-end',
		flexDirection: 'row'
	},
	column: {
		transformOrigin: 'bottom'
	},
	root: {
		alignItems: 'center'
	}
});
