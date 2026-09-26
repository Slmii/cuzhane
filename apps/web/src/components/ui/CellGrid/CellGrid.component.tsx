import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { memo, useState } from 'react';
import { LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import type { CellGridItem, CellGridProps } from './CellGrid.types';

/**
 * How long a cell takes to change: fill, border, border width and its numeral, all together.
 *
 * **This is now the whole animation.** `FILL_STEP_MS` is 0, so nothing is staggered and every
 * cell in a claimed block moves at once — this single number is the entire üstlen effect,
 * where it used to be one part of a much longer cascade.
 *
 * `pool-fill.html` sets `--fill-dur` at 420ms and this has come down twice since: to 300, and
 * now to 160. That is deliberate rather than drift — the design's figure assumed a staggered
 * sweep where each cell's fade overlapped its neighbour's, so the *block* read as moving even
 * though any one cell was slow. With every cell moving together there is nothing to overlap,
 * and the same 420 reads as the whole board hesitating.
 */
const COLOR_DURATION_MS = 160;

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
type TransitionProperty = 'opacity' | 'backgroundColor' | 'borderColor' | 'borderWidth' | 'color';

const transitionFor = (property: TransitionProperty | TransitionProperty[], delayMs: number) => ({
	transitionDelay: delayMs,
	transitionDuration: COLOR_DURATION_MS,
	transitionProperty: property
});

/**
 * Design 05's two cell animations, transcribed from `spot-stepper.html` — its `om-pop` and
 * `om-shrink` — and kept as keyframes because that is how the prototype writes them and the
 * shapes don't survive translation into a spring.
 *
 * `om-pop` overshoots to 1.14 before settling — a plain 0→1 zoom reads as the grid merely
 * appearing, where the design has each new seat land with a small bounce. `om-shrink` is
 * what a removed seat does instead of blinking out: it collapses to a fifth of its size
 * and fades, which is only possible because the caller keeps it mounted long enough.
 *
 * **Durations and curves are the prototype's, to the millisecond**: `.38s` on
 * `cubic-bezier(.2,1.35,.4,1)` and `.3s ease-in`. They had drifted to 300 and 240 with no
 * easing at all, and a linear collapse is most of why removal read as a cut rather than a
 * motion.
 *
 * **They are CSS animations, not Reanimated `entering` layout animations, and the difference
 * is visible.** A layout animation is registered *after* its view mounts, and Reanimated keeps
 * the view hidden until it takes over — so a freshly mounted ghost was painted at opacity 0 for
 * a frame, appeared at full size, and only then began to shrink. On screen that is "the cells
 * disappear, come back, and then the animation starts", and it is worse on Android, where the
 * mount and the animation land in separate frames more often. A CSS animation is part of the
 * style the view is committed with, so it is already running on the first frame the cell
 * exists, and `animationFillMode: 'both'` holds the 0% state through the stagger delay exactly
 * as the prototype's `both` does. It is also the more literal transcription — the design writes
 * both of these as CSS animations, and this is the same declaration with the same numbers.
 */
/*
 * Selectors are **percentage strings**, exactly as the prototype writes them. A CSS keyframe
 * selector here is either a fraction of 1 or a percentage — a bare `62` is neither, and
 * Reanimated throws "Invalid keyframe selector" on mount rather than degrading. (Layout
 * animations take bare numbers, which is what these were before, and the two conventions look
 * identical at a glance.)
 */
const POP_KEYFRAMES = {
	'0%': { opacity: 0, transform: [{ scale: 0.55 }] },
	'62%': { opacity: 1, transform: [{ scale: 1.14 }] },
	'100%': { opacity: 1, transform: [{ scale: 1 }] }
};

const SHRINK_KEYFRAMES = {
	'0%': { opacity: 1, transform: [{ scale: 1 }] },
	'100%': { opacity: 0, transform: [{ scale: 0.2 }] }
};

/*
 * **Each of these opens by spreading its own 0% frame into the static style, and that is not
 * decoration.** Reanimated attaches a CSS animation from `componentDidMount`, so there is one
 * frame where the view is already on screen wearing its plain style and the animation has not
 * started. Whenever that plain style differs from the animation's first keyframe, the cell is
 * painted once in the wrong state and then jumps to the right one.
 *
 * It only showed on the pop, which is what made it look like two separate bugs: `om-shrink`
 * opens at `opacity: 1, scale: 1`, which *is* a cell's natural style, so its uncovered frame was
 * indistinguishable — while `om-pop` opens at `opacity: 0, scale: .55`, so a new seat appeared
 * at full size, vanished, and only then popped in. Declaring the opening frame as the resting
 * style closes the gap for both, and `animationFillMode: 'both'` is what then overrides it: the
 * forwards fill holds the 100% frame once the animation is done, so a popped cell stays at full
 * size rather than falling back to the `opacity: 0` written here. (That the ghosts stay
 * collapsed instead of snapping back is the same fill doing the same job, already proven.)
 */

/** `om-pop .38s cubic-bezier(.2,1.35,.4,1) <delay>ms both`. */
const popAnimation = (delay: number) => ({
	...POP_KEYFRAMES['0%'],
	animationDelay: delay,
	animationDuration: 380,
	animationFillMode: 'both' as const,
	animationName: POP_KEYFRAMES,
	animationTimingFunction: cubicBezier(0.2, 1.35, 0.4, 1)
});

/** `om-shrink .3s ease-in <delay>ms both`. */
const shrinkAnimation = (delay: number) => ({
	...SHRINK_KEYFRAMES['0%'],
	animationDelay: delay,
	animationDuration: 300,
	animationFillMode: 'both' as const,
	animationName: SHRINK_KEYFRAMES,
	animationTimingFunction: 'ease-in' as const
});

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
 *
 * Exported for the one board that is not a square lattice — the Hizb's, a row of cells per
 * work (`HizbBoard`) — so its cells are these cells, with the same easing and the same
 * rules about the hatch, rather than a second copy that could drift from them.
 */
export const Cell = memo(({ borderWidth, isReducedMotion, item, onPress, radius, size }: CellProps) => {
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
	 * Both run on mount, including the ghost's shrink: the ghost arrives already doomed and
	 * plays its exit on the way in, because the caller — not this cell — decides when a removed
	 * seat is actually dropped. That is exactly what the prototype does, where a leaving cell is
	 * appended to the grid carrying `om-shrink`.
	 *
	 * **Captured once, at mount, and never recomputed.** A CSS animation lives in the style, so
	 * unlike a layout animation it can be taken *away* again — and `entryDelay` does go away, one
	 * frame later, when `SpotsGrid`'s `shownCount` catches up to `total`. Read live, that removed
	 * `animationName` mid-pop and the new seats snapped to full size after a single frame of
	 * movement. Reading it from state pins the declaration to this cell's lifetime, which is the
	 * property `entering` used to give for free.
	 *
	 * Holding it after it finishes costs nothing: `fillMode: 'both'` settles on the 100% frame,
	 * which for the pop is the cell's natural size and opacity.
	 */
	const [animation] = useState(() =>
		isReducedMotion
			? null
			: item.ghostDelay !== undefined
			? shrinkAnimation(item.ghostDelay)
			: item.entryDelay !== undefined
			? popAnimation(item.entryDelay)
			: null
	);

	const label =
		item.label === undefined ? null : (
			// The numeral eases with the box it sits in. Its colour flips hardest of the four —
			// a read bab's label goes to `onAccent` — so leaving it to snap while the fill eased
			// was the most visible half-transition on the board.
			<Typography
				color={item.labelColor}
				isAnimated={!isReducedMotion}
				style={{
					...styles.label,
					...(isReducedMotion ? null : transitionFor('color', fillDelay))
				}}
				variant='stat'
				weight='semibold'
			>
				{item.label}
			</Typography>
		);

	return (
		<Animated.View
			accessibilityLabel={onPress ? undefined : item.accessibilityLabel}
			style={{
				...styles.cell,
				// The pop or the shrink, plus the opening frame it rests at until it starts — see
				// above. Nothing below this sets `opacity` or `transform`, so the spread stands.
				...animation,
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
				 * Fill, border and border width together — the cell's whole box eases as one.
				 * The label's colour eases with them, on the `Typography` below.
				 *
				 * Nothing else moves: no scale, no opacity, no size. That is `pool-fill.html`'s
				 * intent for the üstlen sweep, where at forty cells a pop reads as noise while a
				 * colour sweep reads as ownership. Border was briefly excluded from this on the
				 * grounds that it matches the fill in every state but "sen üstlendin" — but in
				 * that state it *is* a ring, and a ring snapping into place while the fill behind
				 * it eases is the one place the omission showed.
				 */
				...(isReducedMotion
					? null
					: transitionFor(['backgroundColor', 'borderColor', 'borderWidth'], fillDelay))
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
const CellGridComponent = ({
	borderWidth = 0,
	columns,
	gap = 4,
	items,
	minRows,
	onPressCell,
	radius = 6,
	style
}: CellGridProps) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const [gridWidth, setGridWidth] = useState(0);
	/*
	 * **Rounded *down* to the pixel grid, never left fractional.**
	 *
	 * The row wraps, so the cells and their gaps have to fit inside the measured width — and a
	 * fractional size is rounded to the device's pixels per cell, upwards as often as not. Ten of
	 * those overflow by a fraction and the tenth drops to a line of its own, which is the spots
	 * picker showing nine across with one orphan beneath. It is the same rounding the placeholder
	 * branch below describes for percentage widths; the only difference is that a measured width
	 * hides it until some layout change lands on the wrong side of a pixel. Flooring gives back at
	 * most one pixel across the whole row and cannot overflow.
	 */
	const scale = PixelRatio.get();
	const cellSize = gridWidth > 0 ? Math.floor(((gridWidth - gap * (columns - 1)) / columns) * scale) / scale : 0;

	const handleLayout = (event: LayoutChangeEvent) => {
		setGridWidth(event.nativeEvent.layout.width);
	};

	/*
	 * The floor the caller asked for, in points. A `minHeight` rather than a `height`, so a grid
	 * that outgrows the reservation still grows — the point is only that it never *shrinks* below
	 * what it may need again in a moment.
	 */
	const reservedRows = Math.max(minRows ?? 0, Math.ceil(items.length / columns));
	const minHeight = minRows === undefined ? undefined : minRows * cellSize + (minRows - 1) * gap;

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
				{/* `reservedRows`, not the item count: the measuring pass has to claim the same
				    height the real board will, or reserving one below buys nothing on first paint. */}
				{Array.from({ length: reservedRows }, (_, rowIndex) => {
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
		<View onLayout={handleLayout} style={[styles.grid, { gap, minHeight }, style]}>
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

/**
 * Memoised as a whole, not just per cell.
 *
 * `Cell` being `memo`'d stops a hundred *cells* re-rendering, but the grid around them still
 * mapped every item into a fresh element on each parent render, and then ran the comparator
 * a hundred times to discover nothing had changed. That is affordable once and wasteful
 * three times in a second — which is what taking a pool slot does: the optimistic paint, the
 * server's answer, and the drain timer each re-render the screen while the sweep is running.
 *
 * This only pays if callers hold `items` and `onPressCell` steady, which is the same thing
 * `Cell` already asks of them. `PoolScreen` was passing a fresh `drainingSlotIndexes` array
 * inline, which sat in `PoolGrid`'s dependency list and meant its `items` memo never hit
 * once — worth checking a new caller for before assuming this is doing anything.
 */
export const CellGrid = memo(CellGridComponent);

CellGrid.displayName = 'CellGrid';

const styles = StyleSheet.create({
	cell: {
		overflow: 'hidden'
	},
	centered: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	grid: {
		// Rows stay packed at the top, so a `minHeight` taller than the cells leaves its slack
		// underneath rather than spreading it between the rows.
		alignContent: 'flex-start',
		flexDirection: 'row',
		flexWrap: 'wrap'
	},
	hatch: {
		...StyleSheet.absoluteFill
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
