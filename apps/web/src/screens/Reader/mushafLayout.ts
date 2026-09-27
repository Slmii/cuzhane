/**
 * The arithmetic behind `MushafPage`, kept pure so it can be tested without a layout engine.
 * Widths come from the page's measuring pass; nothing here knows about fonts or views.
 */

const rowWidth = <T>(items: T[], gap: number, widthOf: (item: T) => number): number =>
	items.reduce((total, item) => total + widthOf(item), 0) + gap * Math.max(0, items.length - 1);

/** True when every printed line fits the column at its measured width, gaps included. */
export const fitsOnLines = <T>(lines: T[][], available: number, gap: number, widthOf: (item: T) => number): boolean =>
	lines.every(line => rowWidth(line, gap, widthOf) <= available);

/**
 * Breaks a run of words into rows no wider than `available`, greedily, in reading order.
 *
 * **An ayah mark is never the first thing on a row.** It closes the verse before it, so it is
 * bound to the word it follows and the two move to the next row together. A word wider than
 * the whole row still gets a row of its own — too wide is better than missing.
 */
export const flowRows = <T>(
	items: T[],
	available: number,
	gap: number,
	widthOf: (item: T) => number,
	isEnd: (item: T) => boolean
): T[][] => {
	const units: T[][] = [];

	for (const item of items) {
		const last = units.at(-1);

		if (isEnd(item) && last) {
			last.push(item);
		} else {
			units.push([item]);
		}
	}

	const rows: T[][] = [];
	let row: T[] = [];

	for (const unit of units) {
		if (row.length > 0 && rowWidth([...row, ...unit], gap, widthOf) > available) {
			rows.push(row);
			row = [];
		}

		row.push(...unit);
	}

	if (row.length > 0) {
		rows.push(row);
	}

	return rows;
};

/** How a row's words sit across it — `MushafPage`'s three row styles. */
export type RowAlignment = 'spread' | 'start' | 'centred';

/** A band behind part of a row, in points from the row's left edge. */
export type RowBand = { left: number; right: number };

/** How far a band reaches past the words it holds, where there is room — the design's inset. */
const BAND_REACH = 6;

/**
 * **Where the flagged words of one row sit**, as bands to paint behind them — the sajdah verse's
 * gilt wash. One band per unbroken stretch of flagged words.
 *
 * Worked out from the widths rather than measured off the screen, because the row lays itself
 * out by the same rules: right to left (`row-reverse`), and then `spread` spaces the words to
 * fill the row (`space-between`, never closer than `gap`), `start` packs them from the right at
 * `gap`, and `centred` packs them at `gap` in the middle. A band reaches `BAND_REACH` past its
 * outer words — at most half the space to a neighbour, so it never covers the next verse.
 */
export const rowBands = (
	widths: number[],
	flags: boolean[],
	rowWidth: number,
	gap: number,
	alignment: RowAlignment
): RowBand[] => {
	const count = widths.length;
	const total = widths.reduce((sum, width) => sum + width, 0);
	const spacing = alignment === 'spread' && count > 1 ? Math.max(gap, (rowWidth - total) / (count - 1)) : gap;
	const packed = total + gap * Math.max(0, count - 1);
	let right = alignment === 'centred' ? rowWidth - (rowWidth - packed) / 2 : rowWidth;

	// Each word's right and left edge, first word at the right.
	const edges = widths.map(width => {
		const edge = { left: right - width, right };

		right = edge.left - spacing;

		return edge;
	});

	// Full reach at the row's own edge, half the space at most toward a neighbour. The first word's
	// right side and the last word's left side are the row's edges; every other side has a word.
	const between = Math.min(BAND_REACH, spacing / 2);
	const reachRight = (index: number) => (index === 0 ? BAND_REACH : between);
	const reachLeft = (index: number) => (index === count - 1 ? BAND_REACH : between);
	const bands: RowBand[] = [];
	let runStart = -1;

	for (let index = 0; index <= count; index += 1) {
		const isFlagged = index < count && flags[index] === true;

		if (isFlagged && runStart === -1) {
			runStart = index;
		}

		if (!isFlagged && runStart !== -1) {
			const first = edges[runStart];
			const last = edges[index - 1];

			if (first && last) {
				bands.push({ left: last.left - reachLeft(index - 1), right: first.right + reachRight(runStart) });
			}

			runStart = -1;
		}
	}

	return bands;
};
