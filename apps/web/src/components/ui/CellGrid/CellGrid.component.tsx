import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
	Keyframe,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withTiming
} from 'react-native-reanimated';
import type { CellGridItem, CellGridProps } from './CellGrid.types';

/** `pool-fill.html`'s `--fill-dur`: the üstlen sweep is colour only, 420ms a cell. */
const COLOR_DURATION_MS = 420;

/**
 * Design 05's two cell animations, kept as keyframes because that is how the prototype
 * writes them and the shapes don't survive translation into a spring.
 *
 * `sg-pop` overshoots to 1.14 before settling — a plain 0→1 zoom reads as the grid merely
 * appearing, where the design has each new seat land with a small bounce. `sg-shrink` is
 * what a removed seat does instead of blinking out: it collapses to a fifth of its size
 * and fades, which is only possible because the caller keeps it mounted long enough.
 *
 * **Built per cell, never shared.** `Keyframe` is mutable: `.delay()` writes to the
 * instance and hands back the same object, so a module-level constant reused across a
 * grid ends up with whatever delay the last cell asked for — every cell then animates on
 * one schedule, which is no stagger at all.
 */
const pop = (delay: number) =>
	new Keyframe({
		0: { opacity: 0, transform: [{ scale: 0.55 }] },
		62: { opacity: 1, transform: [{ scale: 1.14 }] },
		100: { opacity: 1, transform: [{ scale: 1 }] }
	})
		.duration(380)
		.delay(delay);

const shrink = (delay: number) =>
	new Keyframe({
		0: { opacity: 1, transform: [{ scale: 1 }] },
		100: { opacity: 0, transform: [{ scale: 0.2 }] }
	})
		.duration(300)
		.delay(delay);

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
	const isReducedMotion = useReducedMotion();
	/*
	 * `pool-fill.html`: colour is the only channel, and the delay is the whole effect.
	 * Taking a block repaints its cells left to right — `fillDelay` is the cell's position
	 * inside its slot times 70ms — which is what makes a 13-bab claim legible as *yours*.
	 * Without it thirteen cells change at once and the fill reads as no animation at all.
	 * Nothing scales: at forty cells a pop reads as noise where a sweep reads as ownership.
	 *
	 * **But the first paint is never animated.** A transition needs a previous value to move
	 * from, and on mount there isn't one — so `withDelay` held the cell at nothing for the
	 * length of its delay and then faded it in. With the pool's stagger that left the board
	 * invisible for the best part of a second, and for a long run in the round history for
	 * several: the card rendered its header, legend and hint around an empty square. The
	 * sweep is about babs *changing hands*, so it starts on the second render and a board
	 * arriving for the first time simply appears.
	 */
	const hasPainted = useSharedValue(false);
	const fillDelay = item.fillDelay ?? 0;

	useEffect(() => {
		hasPainted.value = true;
	}, [hasPainted]);

	/**
	 * Snap on the first evaluation, ease on every one after. Read inside the worklet rather
	 * than during render — and when the flag flips the style re-runs and eases the colour to
	 * the value it already holds, which is a no-op.
	 */
	const easeTo = (value: string) => {
		'worklet';

		return hasPainted.value && !isReducedMotion
			? withDelay(fillDelay, withTiming(value, { duration: COLOR_DURATION_MS }))
			: value;
	};

	const animatedStyle = useAnimatedStyle(() => ({
		backgroundColor: easeTo(item.backgroundColor),
		borderColor: easeTo(item.borderColor ?? item.backgroundColor)
	}));
	/*
	 * The hatch fades on the same curve as the fill instead of being mounted and unmounted.
	 * Taking a pool block eases its cells from the hatched "nobody's" grey to accent over
	 * 450ms, and a hatch that disappeared in a single frame tore the two halves of that one
	 * change apart — the stripes blinked out, then the colour caught up.
	 */
	const hatchStyle = useAnimatedStyle(() => {
		const target = item.isHatched ? 1 : 0;

		return {
			opacity:
				hasPainted.value && !isReducedMotion
					? withDelay(fillDelay, withTiming(target, { duration: COLOR_DURATION_MS }))
					: target
		};
	});

	/*
	 * Both are `entering`, including the ghost's shrink. An `exiting` animation would have to
	 * survive the cell being unmounted, and the caller is what decides when a removed cell
	 * actually goes — so the ghost mounts already-doomed and plays its exit on the way in,
	 * exactly as the prototype's CSS does.
	 */
	const entering = isReducedMotion
		? undefined
		: item.ghostDelay !== undefined
		? shrink(item.ghostDelay)
		: item.entryDelay !== undefined
		? pop(item.entryDelay)
		: undefined;

	return (
		<Animated.View
			entering={entering}
			style={[styles.cell, { borderRadius: radius, borderWidth, height: size, width: size }, animatedStyle]}
		>
			<Animated.View pointerEvents='none' style={[styles.hatch, hatchStyle]}>
				<Hatch radius={radius} />
			</Animated.View>
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
 * A square lattice of equally-sized cells. The design uses this shape four times —
 * the 100-bab progress board, the spots picker, the 30-day activity heatmap and the
 * pool board — so the measuring and sizing logic lives here once.
 *
 * Cell size is derived from the measured container width rather than percentage
 * flex-basis: rounding a percentage per column drifts by a pixel each time, which
 * is plainly visible across a 10- or 15-wide grid.
 *
 * **The measuring pass reserves height and shows bones.** Width is only known after
 * `onLayout`, and rendering nothing at all until then gave the container a height of zero
 * for a frame: a four-row board appeared out of nowhere and pushed everything below it
 * down. So the first pass lays out the same number of slots by percentage — the one place
 * that sizing is allowed, because it is replaced the moment the real width arrives.
 *
 * The slots are drawn in the neutral `GridSkeleton` uses, not in the cells' real colours.
 * Painting the real board made it appear to render twice, at very slightly the wrong size;
 * drawing nothing at all was worse — pushing a screen keeps the JS thread busy long enough
 * that the measure and its re-render can take the better part of a second, and the card sat
 * there with a header, a legend and a hole in the middle. A neutral lattice reads as the
 * board arriving, which is what is actually happening.
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
	const { theme } = useThemeContext();
	const [gridWidth, setGridWidth] = useState(0);
	const cellSize = gridWidth > 0 ? (gridWidth - gap * (columns - 1)) / columns : 0;

	const handleLayout = (event: LayoutChangeEvent) => {
		setGridWidth(event.nativeEvent.layout.width);
	};

	if (cellSize === 0) {
		return (
			/*
			 * Explicit rows of `flex: 1`, not a wrapping row of percentage widths. `10%` is
			 * rounded to the pixel grid per cell, ten of those overflow the container by a
			 * fraction, and the row wrapped at nine — leaving the lattice a column short with
			 * a gap down the right. Dividing a row by flex has no such rounding: the children
			 * share exactly what there is.
			 */
			<View onLayout={handleLayout} style={style}>
				{Array.from({ length: Math.ceil(items.length / columns) }, (_, rowIndex) => {
					const row = items.slice(rowIndex * columns, rowIndex * columns + columns);

					return (
						<View key={rowIndex} style={styles.placeholderRow}>
							{row.map(item => (
								<View key={item.key} style={[styles.placeholderSlot, { padding: gap / 2 }]}>
									<View
										style={[
											styles.placeholderCell,
											{ backgroundColor: theme.colors.secondary, borderRadius: radius }
										]}
									/>
								</View>
							))}
							{/* A short last row keeps its cells the width of a full one. */}
							{Array.from({ length: columns - row.length }, (_, spacerIndex) => (
								<View key={`spacer-${spacerIndex}`} style={styles.placeholderSlot} />
							))}
						</View>
					);
				})}
			</View>
		);
	}

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
	hatch: {
		...StyleSheet.absoluteFillObject
	},
	// Square by aspect rather than by a measured height — the point of this pass is to claim
	// the right height before anything has been measured.
	// Square by aspect rather than by a measured height — the point of this pass is to claim
	// the right height before anything has been measured.
	placeholderCell: {
		aspectRatio: 1,
		width: '100%'
	},
	placeholderRow: {
		flexDirection: 'row'
	},
	// `flex: 1` so a row's cells divide it exactly, with no percentage left over.
	placeholderSlot: {
		flex: 1,
		flexDirection: 'row'
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
