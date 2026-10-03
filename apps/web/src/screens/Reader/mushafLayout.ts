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
/**
 * Each word's left and right edge in a row, first word at the right — by the same rules the row
 * lays itself out by (see `rowBands`), and with the spacing between them.
 */
const rowEdges = (widths: number[], rowWidth: number, gap: number, alignment: RowAlignment) => {
	const count = widths.length;
	const total = widths.reduce((sum, width) => sum + width, 0);
	const spacing = alignment === 'spread' && count > 1 ? Math.max(gap, (rowWidth - total) / (count - 1)) : gap;
	const packed = total + gap * Math.max(0, count - 1);
	let right = alignment === 'centred' ? rowWidth - (rowWidth - packed) / 2 : rowWidth;

	const edges = widths.map(width => {
		const edge = { left: right - width, right };

		right = edge.left - spacing;

		return edge;
	});

	return { edges, spacing };
};

export const rowBands = (
	widths: number[],
	flags: boolean[],
	rowWidth: number,
	gap: number,
	alignment: RowAlignment,
	/** How far the band reaches past its words — the sajdah band's own unless given. */
	reach = BAND_REACH
): RowBand[] => {
	const count = widths.length;
	const { edges, spacing } = rowEdges(widths, rowWidth, gap, alignment);

	// Full reach at the row's own edge, half the space at most toward a neighbour. The first word's
	// right side and the last word's left side are the row's edges; every other side has a word.
	const between = Math.min(reach, spacing / 2);
	const reachRight = (index: number) => (index === 0 ? reach : between);
	const reachLeft = (index: number) => (index === count - 1 ? reach : between);
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

/*
 * **The lines of a Hüsrev page**, as fractions of the page image. The images are cropped to the
 * text block and set on one grid: fitted across a hundred of them, line *i*'s middle is at
 * 4.30 % + i × 6.54 % of the height, within 0.4 % (about two points on a phone). A page is a
 * picture with no verse positions, so this grid is what "the line being read" means there
 * ("Göster", Q3).
 *
 * **The two opening pages are framed** — Al-Fâtiha and the start of Al-Baqara sit in an
 * illuminated border, seven lines each in a white block: the basmala's middle at 22.8 % and
 * 7.56 % apart (measured on both, within 0.4 %), the block from 18 % to 82 % of the width.
 */
export type HusrevGrid = { first: number; pitch: number; lines: number; left: number; right: number };

const HUSREV_GRID: HusrevGrid = { first: 0.043, left: 0, lines: 15, pitch: 0.0654, right: 1 };
const HUSREV_OPENING_GRID: HusrevGrid = { first: 0.228, left: 0.18, lines: 7, pitch: 0.0756, right: 0.82 };

/** The grid of page `page` (0-based, as the images are numbered). */
export const husrevGrid = (page: number): HusrevGrid => (page <= 1 ? HUSREV_OPENING_GRID : HUSREV_GRID);

/** Line `line` (1-based) as a slot of the page image: its top and its height, both fractions. */
export const husrevLineSlot = (line: number, grid: HusrevGrid = HUSREV_GRID) => ({
	height: grid.pitch,
	top: grid.first + (line - 1) * grid.pitch - grid.pitch / 2
});

/** The line at a height on the page image, as a fraction; past either end, the end line. */
export const husrevLineAt = (fraction: number, grid: HusrevGrid = HUSREV_GRID) =>
	Math.min(grid.lines, Math.max(1, Math.round((fraction - grid.first) / grid.pitch) + 1));
