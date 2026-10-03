import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated';
import type { GridSkeletonProps } from './GridSkeleton.types';

const PULSE_MS = 780;
/**
 * Shallow on purpose. The bones sit on a white card and are only a few percent darker than
 * it; dipping toward half opacity took that difference below the point where the lattice
 * was visible at all, and the card read as blank.
 */
const PULSE_MIN_OPACITY = 0.72;
/** The lattice's own metrics, so the placeholder occupies the height the grid will. */
const CELL_GAP = 3;
const CELL_RADIUS = 4;
/** `BabGrid`'s — `CellGrid` with 4 apart and radius 6 — for a bare board. */
const BARE_CELL_GAP = 4;
const BARE_CELL_RADIUS = 6;

/**
 * The loading stand-in for a bab lattice: the card, a chip-and-bars header, the cells, and
 * the legend stubs beneath them.
 *
 * It draws the *shape* of the answer rather than a spinner. A centred spinner says only
 * "wait"; then the real card arrives at full height and shoves the page. This occupies
 * roughly the right space from the first frame, so what changes when the data lands is the
 * content, not the layout.
 *
 * Cells are sized by percentage rather than measured width — the exception `CellGrid`'s own
 * placeholder pass makes for the same reason. Nothing here is read, so a fraction of a pixel
 * per column cannot be seen, and waiting for a measurement would reintroduce the empty frame
 * this exists to remove.
 */
export const GridSkeleton = ({
	cellCount,
	columns = 10,
	hasHeader = true,
	isBare = false,
	legendCount = 3,
	style
}: GridSkeletonProps) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const pulse = useSharedValue(1);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		// Breathing, not blinking: a flat grey block reads as content that failed to load.
		pulse.value = withRepeat(
			withSequence(withTiming(PULSE_MIN_OPACITY, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })),
			-1,
			false
		);
	}, [isReducedMotion, pulse]);

	const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

	/**
	 * One placeholder shape. `secondary` rather than `track`: the bones sit on a white card,
	 * and the board's own track tone is close enough to white that the whole lattice read as
	 * an empty card. This is the same neutral the design's bones use.
	 */
	const bone = (extra: StyleProp<ViewStyle>): StyleProp<ViewStyle> => [
		styles.bone,
		{ backgroundColor: theme.colors.secondary },
		extra
	];

	const lattice = (
		<View style={isBare ? styles.bareLattice : null}>
			{Array.from({ length: Math.ceil(cellCount / columns) }, (_, rowIndex) => {
				const cellsInRow = Math.min(columns, cellCount - rowIndex * columns);

				return (
					<View key={rowIndex} style={styles.row}>
						{Array.from({ length: cellsInRow }, (_, cellIndex) => (
							<View key={cellIndex} style={isBare ? styles.bareCellSlot : styles.cellSlot}>
								<View style={bone(isBare ? styles.bareCell : styles.cell)} />
							</View>
						))}
						{/* A short last row keeps its cells the width of a full one. */}
						{Array.from({ length: columns - cellsInRow }, (_, spacerIndex) => (
							<View
								key={`spacer-${spacerIndex}`}
								style={isBare ? styles.bareCellSlot : styles.cellSlot}
							/>
						))}
					</View>
				);
			})}
		</View>
	);

	// Bare: the lattice and `BabLegend`'s keys only, 12 apart as the section body spaces them.
	if (isBare) {
		return (
			<Animated.View style={[pulseStyle, styles.bare, style]}>
				{lattice}
				{legendCount > 0 ? (
					<View style={styles.bareLegend}>
						{Array.from({ length: legendCount }, (_, index) => (
							<View key={index} style={styles.bareLegendItem}>
								<View style={bone(styles.bareLegendSwatch)} />
								<View style={bone(styles.legendBar)} />
							</View>
						))}
					</View>
				) : null}
			</Animated.View>
		);
	}

	return (
		<CardSurface style={[styles.card, style]}>
			<Animated.View style={pulseStyle}>
				{hasHeader ? (
					<View style={styles.header}>
						<View style={bone(styles.headerChip)} />
						<View style={bone(styles.headerBar)} />
						<View style={bone(styles.headerBarTrailing)} />
					</View>
				) : null}

				{/*
				 * Explicit rows of `flex: 1`, not a wrapping row of percentage widths — ten
				 * cells at `10%` each round up past the container, the row wraps at nine, and
				 * the lattice ends a column short with a gap down its right edge.
				 */}
				<View>
					{Array.from({ length: Math.ceil(cellCount / columns) }, (_, rowIndex) => {
						const cellsInRow = Math.min(columns, cellCount - rowIndex * columns);

						return (
							<View key={rowIndex} style={styles.row}>
								{Array.from({ length: cellsInRow }, (_, cellIndex) => (
									<View key={cellIndex} style={styles.cellSlot}>
										<View style={bone(styles.cell)} />
									</View>
								))}
								{/* A short last row keeps its cells the width of a full one. */}
								{Array.from({ length: columns - cellsInRow }, (_, spacerIndex) => (
									<View key={`spacer-${spacerIndex}`} style={styles.cellSlot} />
								))}
							</View>
						);
					})}
				</View>

				{legendCount > 0 ? (
					<View style={styles.legend}>
						{Array.from({ length: legendCount }, (_, index) => (
							<View key={index} style={styles.legendItem}>
								<View style={bone(styles.legendSwatch)} />
								<View style={bone(styles.legendBar)} />
							</View>
						))}
					</View>
				) : null}
			</Animated.View>
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	bare: { gap: 12 },
	// Each slot padded by half the gap and the lattice drawn back by the same half: cells sized as
	// the measured `CellGrid` sizes them, flush with the card's body.
	bareLattice: { margin: -BARE_CELL_GAP / 2 },
	bareCellSlot: { flex: 1, flexDirection: 'row', padding: BARE_CELL_GAP / 2 },
	bareCell: { aspectRatio: 1, borderRadius: BARE_CELL_RADIUS, width: '100%' },
	// `BabLegend`: 14 across, 6 between lines, an 11pt swatch on the 17pt caption line.
	bareLegend: { columnGap: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
	bareLegendItem: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 17 },
	bareLegendSwatch: { borderRadius: 3, height: 11, width: 11 },
	bone: {
		borderRadius: 5
	},
	card: {
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	cell: {
		aspectRatio: 1,
		borderRadius: CELL_RADIUS,
		width: '100%'
	},
	// Padding rather than the grid's `gap`: percentage widths already fill the row exactly,
	// so a gap on top would overflow and wrap a column early.
	// `flex: 1` so a row's cells divide it exactly, with no percentage left over. The gap is
	// padding inside each slot rather than the row's `gap`, which would push the total past
	// the container.
	cellSlot: {
		flex: 1,
		flexDirection: 'row',
		padding: CELL_GAP / 2
	},
	row: {
		flexDirection: 'row'
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		marginBottom: 14
	},
	headerBar: {
		height: 10,
		width: 110
	},
	headerBarTrailing: {
		height: 10,
		marginLeft: 'auto',
		width: 78
	},
	headerChip: {
		borderRadius: 10,
		height: 28,
		width: 62
	},
	legend: {
		columnGap: 13,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 13,
		rowGap: 6
	},
	legendBar: {
		height: 8,
		width: 54
	},
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	legendSwatch: {
		borderRadius: 3,
		height: 10,
		width: 10
	}
});
