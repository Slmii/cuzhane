import { describe, expect, it } from 'vitest';
import { flowRows, fitsOnLines, rowBands } from './mushafLayout';

type Item = { id: string; width: number; isEnd?: boolean };

const widthOf = (item: Item) => item.width;
const isEnd = (item: Item) => item.isEnd === true;
const ids = (rows: Item[][]) => rows.map(row => row.map(item => item.id));

describe('flowRows', () => {
	it('fills each row as far as the width allows, gaps included', () => {
		const items = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, width: 30 }));

		// Three words take 30 + 5 + 30 + 5 + 30 = 100; a fourth would need 135.
		expect(ids(flowRows(items, 100, 5, widthOf, isEnd))).toEqual([
			['a', 'b', 'c'],
			['d', 'e']
		]);
	});

	it('never opens a row on an ayah mark — the mark rides with the word before it', () => {
		const items: Item[] = [
			{ id: 'a', width: 40 },
			{ id: 'b', width: 40 },
			{ id: 'end', width: 15, isEnd: true },
			{ id: 'c', width: 40 }
		];

		// "b" alone would fit beside "a"; "b" with its mark (40 + 5 + 15) does not, so both move.
		expect(ids(flowRows(items, 100, 5, widthOf, isEnd))).toEqual([['a'], ['b', 'end'], ['c']]);
	});

	it('gives a word wider than the row a row of its own rather than dropping it', () => {
		const items = [
			{ id: 'a', width: 20 },
			{ id: 'long', width: 150 },
			{ id: 'b', width: 20 }
		];

		expect(ids(flowRows(items, 100, 5, widthOf, isEnd))).toEqual([['a'], ['long'], ['b']]);
	});

	it('returns no rows for no words', () => {
		expect(flowRows([], 100, 5, widthOf, isEnd)).toEqual([]);
	});
});

describe('fitsOnLines', () => {
	it('keeps the printed lines only when every one of them fits', () => {
		const line = (...widths: number[]) => widths.map((width, index) => ({ id: String(index), width }));

		expect(fitsOnLines([line(30, 30, 30), line(45, 50)], 100, 5, widthOf)).toBe(true);
		// 45 + 5 + 55 = 105: one line too wide is enough to reflow the page.
		expect(fitsOnLines([line(30, 30, 30), line(45, 55)], 100, 5, widthOf)).toBe(false);
	});
});

describe('rowBands', () => {
	// Three words of 20 in a 100-wide row, right to left: the first at 80–100.
	const widths = [20, 20, 20];

	it('spreads the words over the row and bands the flagged stretch', () => {
		// space-between: (100 − 60) / 2 = 20 between words → 80–100, 40–60, 0–20.
		expect(rowBands(widths, [false, true, true], 100, 5, 'spread')).toEqual([{ left: -6, right: 66 }]);
	});

	it('keeps a band off its neighbours — half the space to them at most', () => {
		// Only the middle word, with 20 either side: reach 6 each way, well short of 10.
		expect(rowBands(widths, [false, true, false], 100, 5, 'spread')).toEqual([{ left: 34, right: 66 }]);
		// Packed at a gap of 4, it may take only 2 each way.
		expect(rowBands(widths, [false, true, false], 100, 4, 'start')).toEqual([{ left: 54, right: 78 }]);
	});

	it('packs from the right for a short row, and in the middle when centred', () => {
		// start: 80–100, 56–76, 32–52.
		expect(rowBands(widths, [true, false, false], 100, 4, 'start')).toEqual([{ left: 78, right: 106 }]);
		// centred: 68 packed, 16 each side → 64–84, 40–60, 16–36; full reach at the row's end,
		// 2 toward the word beside it.
		expect(rowBands(widths, [false, false, true], 100, 4, 'centred')).toEqual([{ left: 10, right: 38 }]);
	});

	it('makes one band per unbroken stretch, and none when nothing is flagged', () => {
		expect(rowBands(widths, [true, false, true], 100, 5, 'spread')).toHaveLength(2);
		expect(rowBands(widths, [false, false, false], 100, 5, 'spread')).toEqual([]);
	});
});
