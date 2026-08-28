import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { memo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Keyframe, useReducedMotion } from 'react-native-reanimated';
import type { CellGridItem, CellGridProps } from './CellGrid.types';

/**
 * How long a single cell takes to change colour. The üstlen sweep is colour only — nothing
 * scales — so this and `FILL_STEP_MS` are the whole effect. `pool-fill.html`'s `--fill-dur`
 * is 420ms; shortened here on request, along with the step.
 */
const COLOR_DURATION_MS = 300;

/**
 * The easing, declared as a CSS transition rather than run from a `useAnimatedStyle`.
 *
 * This is the difference between a board that scrolls and one that doesn't. A mapper per
 * cell means a hundred of them syncing every frame, and measured on the group screen that
 * pinned the **JS thread at 17–24fps for the length of a fling** while the UI thread sat at
 * 35–40. As a transition the style is normalised once and handed to native; the same flings
 * hold 60 on JS. Nothing about the motion changes — same 420ms, same per-cell delay.
 *
 * It also drops the hand-rolled first-paint guard this used to need. A transition animates a
 * *change*, so a cell arriving already has nothing to ease from and simply appears, which is
 * exactly the behaviour the old `hasPainted` shared value existed to reproduce.
 */
const transitionFor = (property: 'opacity' | 'backgroundColor', delayMs: number) => ({
	transitionDelay: delayMs,
	transitionDuration: COLOR_DURATION_MS,
	transitionProperty: property
});

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
		.duration(300)
		.delay(delay);

const shrink = (delay: number) =>
	new Keyframe({
		0: { opacity: 1, transform: [{ scale: 1 }] },
		100: { opacity: 0, transform: [{ scale: 0.2 }] }
	})
		.duration(240)
		.delay(delay);

type CellProps = {
	borderWidth: number;
	/** Read once by the grid and passed down: a hundred cells asking separately is a hundred
	 *  subscriptions to the same accessibility setting. */
	isReducedMotion: boolean;
	item: CellGridItem;
	onPress?: (key: string | number) => void;
	radius: number;
	size: number;
};

type CellHatchProps = {
	fillDelay: number;
	isHatched: boolean;
	isReducedMotion: boolean;
	radius: number;
};

/**
 * The stripes, and the fade that takes them away.
 *
 * `Hatch` draws its bands as rotated views — eight of them at the board's cell size — so a
 * hundred cells carrying one each is nine hundred views of stripe behind a board that is
 * three hundred views of its own. Mounted on every cell it was three quarters of the tree
 * and, on a running group, invisible. Its parent mounts this only for a cell that is
 * hatched or has been.
 *
 * No first-paint guard here, unlike the colour below: this node only exists where the hatch
 * is or was on, so its first evaluation targets 1 against a view that is already opaque and
 * there is nothing to snap.
 *
 * The fade *out* is the one that carries meaning — taking a pool bab eases the stripes off
 * on the same curve as the fill, rather than blinking them out a frame before the colour
 * catches up — and it survives because the parent keeps this mounted after the cell stops
 * being hatched. A bab that becomes pool while you are looking at the board is the other
 * direction, and it now appears rather than fading in: that needs a member to leave or the
 * round to roll mid-screen, and an instant hatch there says the same thing.
 */
const CellHatch = ({ fillDelay, isHatched, isReducedMotion, radius }: CellHatchProps) => (
	<Animated.View
		pointerEvents='none'
		/* One flat object, not an array: Reanimated reads the transition properties off the
		   style itself, and inside an array element they are just unknown keys. */
		style={{
			...styles.hatch,
			opacity: isHatched ? 1 : 0,
			...(isReducedMotion ? null : transitionFor('opacity', fillDelay))
		}}
	>
		<Hatch radius={radius} />
	</Animated.View>
);

/**
 * Compared by value, not by object identity — this is what keeps the üstlen fill smooth.
 *
 * Taking a slot paints the board optimistically and then invalidates, so the server's answer
 * lands a few hundred milliseconds later, mid-sweep. It carries the *same* colours, but as
 * fresh objects, and identity comparison treats that as a change: every cell re-rendered with
 * a new style object and the transitions were re-committed underneath themselves, which is
 * exactly the hitch. Comparing the fields means an answer that agrees with what is already on
 * screen costs nothing at all.
 */
const areCellPropsEqual = (previous: CellProps, next: CellProps) =>
	previous.borderWidth === next.borderWidth &&
	previous.isReducedMotion === next.isReducedMotion &&
	previous.onPress === next.onPress &&
	previous.radius === next.radius &&
	previous.size === next.size &&
	previous.item.accessibilityLabel === next.item.accessibilityLabel &&
	previous.item.backgroundColor === next.item.backgroundColor &&
	previous.item.borderColor === next.item.borderColor &&
	previous.item.entryDelay === next.item.entryDelay &&
	previous.item.fillDelay === next.item.fillDelay &&
	previous.item.ghostDelay === next.item.ghostDelay &&
	previous.item.isHatched === next.item.isHatched &&
	previous.item.label === next.item.label &&
	previous.item.labelColor === next.item.labelColor;

/**
 * One cell. Split out so each can own its animated style — hooks can't run in a loop
 * inside the parent. Colour changes ease rather than snap, so a bab flipping to "read"
 * reads as a transition on the board.
 *
 * **Memoised, which asks something of every caller**: a hundred of these re-rendering
 * because a sheet opened is a hundred animated styles re-evaluated for nothing. That only
 * holds if `items` and `onPressCell` keep their identity between renders, so build them
 * with `useMemo` / `useCallback` rather than inline in the JSX — an inline `.map` hands
 * every cell a new object each render and quietly undoes this.
 */
const Cell = memo(({ borderWidth, isReducedMotion, item, onPress, radius, size }: CellProps) => {
	/*
	 * Whether this cell has ever been hatched, which is what decides if it carries a `Hatch`
	 * at all. Kept rather than read from `item` directly so that a cell losing its hatch —
	 * somebody taking that pool bab — still has a node to fade out.
	 *
	 * Adjusted during render rather than in an effect: an effect would mount the stripes a
	 * frame late, and `react-hooks/set-state-in-effect` rightly objects to the pattern.
	 */
	const [wasHatched, setWasHatched] = useState(item.isHatched === true);

	if (item.isHatched === true && !wasHatched) {
		setWasHatched(true);
	}

	/*
	 * `pool-fill.html`: colour is the only channel, and the delay is the whole effect.
	 * Taking a block repaints its cells left to right — `fillDelay` is the cell's position
	 * inside its slot times 70ms — which is what makes a 13-bab claim legible as *yours*.
	 * Without it thirteen cells change at once and the fill reads as no animation at all.
	 * Nothing scales: at forty cells a pop reads as noise where a sweep reads as ownership.
	 */
	const fillDelay = item.fillDelay ?? 0;
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

	const label =
		item.label === undefined ? null : (
			<Typography color={item.labelColor} style={styles.label} variant='stat' weight='semibold'>
				{item.label}
			</Typography>
		);

	return (
		<Animated.View
			accessibilityLabel={onPress ? undefined : item.accessibilityLabel}
			entering={entering}
			style={{
				...styles.cell,
				// Only when the label stands alone. With a `Pressable` in between, centring here
				// would size it to its text and shrink the tap target to the numeral.
				...(onPress ? null : styles.centered),
				backgroundColor: item.backgroundColor,
				borderColor: item.borderColor ?? item.backgroundColor,
				borderRadius: radius,
				borderWidth,
				height: size,
				width: size,
				/*
				 * The fill and nothing else. `borderColor` used to ease alongside it, which is two
				 * colours interpolating per cell for a channel almost nothing looks at — on the
				 * pool board the border matches the fill in every state but "sen üstlendin", where
				 * it is a ring. Snapping the ring while the fill sweeps is both cheaper and closer
				 * to `pool-fill.html`, which moves one channel on purpose.
				 */
				...(isReducedMotion ? null : transitionFor('backgroundColor', fillDelay))
			}}
		>
			{wasHatched ? (
				<CellHatch
					fillDelay={fillDelay}
					isHatched={item.isHatched === true}
					isReducedMotion={isReducedMotion}
					radius={radius}
				/>
			) : null}
			{/* A board you can't tap — the pool's, the heatmap — doesn't need a hundred touch
			    targets standing by to swallow the scroll. */}
			{onPress ? (
				<Pressable
					accessibilityLabel={item.accessibilityLabel}
					accessibilityRole='button'
					onPress={() => onPress(item.key)}
					style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.6 : 1 }]}
				>
					{label}
				</Pressable>
			) : (
				label
			)}
		</Animated.View>
	);
}, areCellPropsEqual);

Cell.displayName = 'Cell';

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
	const isReducedMotion = useReducedMotion();
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
							isReducedMotion={isReducedMotion}
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
	centered: {
		alignItems: 'center',
		justifyContent: 'center'
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
