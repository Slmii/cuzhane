import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, ZoomIn, ZoomOut } from 'react-native-reanimated';
import type { CellGridItem, CellGridProps } from './CellGrid.types';

const COLOR_DURATION_MS = 450;

type CellProps = {
	borderWidth: number;
	item: CellGridItem;
	onPress?: (key: string | number) => void;
	radius: number;
	size: number;
};

/**
 * One cell. Split out so each can own its animated style — hooks can't run in a loop
 * inside the parent. Colour changes ease rather than snap, so a bab flipping to "read"
 * reads as a transition on the board.
 */
const Cell = ({ borderWidth, item, onPress, radius, size }: CellProps) => {
	const animatedStyle = useAnimatedStyle(() => ({
		backgroundColor: withTiming(item.backgroundColor, { duration: COLOR_DURATION_MS }),
		borderColor: withTiming(item.borderColor ?? item.backgroundColor, { duration: COLOR_DURATION_MS })
	}));

	return (
		<Animated.View
			entering={item.entryDelay === undefined ? undefined : ZoomIn.delay(item.entryDelay).duration(380)}
			exiting={item.entryDelay === undefined ? undefined : ZoomOut.duration(300)}
			style={[styles.cell, { borderRadius: radius, borderWidth, height: size, width: size }, animatedStyle]}
		>
			{item.isHatched ? <Hatch radius={radius} /> : null}
			<Pressable
				accessibilityLabel={item.accessibilityLabel}
				accessibilityRole={onPress ? 'button' : 'none'}
				disabled={!onPress}
				onPress={() => onPress?.(item.key)}
				style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.6 : 1 }]}
			>
				{item.label === undefined ? null : (
					<Typography color={item.labelColor} style={styles.label} variant='stat' weight='semibold'>
						{item.label}
					</Typography>
				)}
			</Pressable>
		</Animated.View>
	);
};

/**
 * A square lattice of equally-sized cells. The design uses this shape three times —
 * the 100-bab progress board, the spots picker, and the 30-day activity heatmap —
 * so the measuring and sizing logic lives here once.
 *
 * Cell size is derived from the measured container width rather than percentage
 * flex-basis: rounding a percentage per column drifts by a pixel each time, which
 * is plainly visible across a 10- or 15-wide grid.
 */
export const CellGrid = ({
	borderWidth = 0,
	columns,
	gap = 4,
	items,
	onPressCell,
	radius = 6,
	style
}: CellGridProps) => {
	const [gridWidth, setGridWidth] = useState(0);
	const cellSize = gridWidth > 0 ? (gridWidth - gap * (columns - 1)) / columns : 0;

	const handleLayout = (event: LayoutChangeEvent) => {
		setGridWidth(event.nativeEvent.layout.width);
	};

	return (
		<View onLayout={handleLayout} style={[styles.grid, { gap }, style]}>
			{cellSize > 0
				? items.map(item => (
						<Cell
							borderWidth={borderWidth}
							item={item}
							key={item.key}
							onPress={onPressCell}
							radius={radius}
							size={cellSize}
						/>
				  ))
				: null}
		</View>
	);
};

const styles = StyleSheet.create({
	cell: {
		overflow: 'hidden'
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap'
	},
	label: {
		fontSize: 9,
		letterSpacing: 0,
		lineHeight: 11
	},
	pressable: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	}
});
