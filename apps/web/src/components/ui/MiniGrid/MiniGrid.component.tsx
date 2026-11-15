import { useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import type { MiniGridProps } from './MiniGrid.types';

/**
 * A small square lattice, sized from its own width.
 *
 * **The cell size cannot be a percentage.** `flexBasis: '10%'` across ten columns is already
 * the whole row, and the nine gaps between them push the last cell onto a second line — so
 * the grid silently gains a row and two grids meant to match stop matching. Subtracting the
 * gaps from a measured width is the same reasoning `CellGrid` records for the real board:
 * percentage sizing drifts a pixel per column, and here it drops a column outright.
 *
 * **This is not `CellGrid`, deliberately.** That primitive memoises a hundred pressable
 * cells, each with a hatch layer and a colour transition, and every one of those costs
 * exists to make the group board scroll at sixty frames. These cells are read-only
 * decoration at a glance's size — on a card in a list, or inside a choice. What is borrowed
 * is the one part that is not optional: measure, then divide.
 *
 * Children are a function of the resolved cell size, and nothing renders until there is
 * one — a first frame at zero would lay out thirty cells on top of each other.
 */
export const MiniGrid = ({ children, columns, gap, style }: MiniGridProps) => {
	const [width, setWidth] = useState(0);
	/*
	 * **Floored to the device pixel grid, or the last cell wraps.** The exact division fills
	 * the row to the point, and Yoga then rounds every cell to the nearest physical pixel —
	 * rounding up as little as a third of a point each time is enough for six cells and five
	 * gaps to exceed the width, so the sixth drops to a row of its own and the grid reads as
	 * five across with a hole down the right.
	 *
	 * It is not a rounding error you can see coming: it depends on the width, the gap and the
	 * screen's scale together, so the same code laid out six across at gap 8 and five at gap
	 * 5. `CellGrid` floors for exactly this reason; this is the same line.
	 */
	const scale = PixelRatio.get();
	const cellSize = width > 0 ? Math.floor(((width - gap * (columns - 1)) / columns) * scale) / scale : 0;

	return (
		<View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.grid, { gap }, style]}>
			{cellSize > 0 ? children(cellSize) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap'
	}
});
