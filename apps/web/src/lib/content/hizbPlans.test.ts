import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLAN_DAYS, startsFor } from '../utils/hizbPlans';
import { HIZB_BLOCKS } from './hizbulhakaik';
import { planBlocks } from './hizbPlans';

const textOf = (blocks: typeof HIZB_BLOCKS) =>
	blocks
		.flatMap(b => b.block.lines.map(l => l.text))
		.join('')
		.replace(/[\s❁]/gu, '');
describe('versioned Hizb content', () => {
	it('covers every source character once in all three divisions', () => {
		for (const days of PLAN_DAYS) {
			const blocks = Array.from({ length: days }, (_, i) => planBlocks(days, i + 1));
			expect(blocks.every(b => b.length > 0)).toBe(true);
			expect(textOf(blocks.flat())).toBe(textOf(HIZB_BLOCKS));
		}
	});
	it('builds the 7- and 15-day plans from whole days of the 32-day sheet', () => {
		const sheetDays = startsFor(32).map(start => start.join(','));
		const sheetDayOf = (start: readonly number[]) => sheetDays.indexOf(start.join(',')) + 1;

		expect(startsFor(7).map(sheetDayOf)).toEqual([1, 5, 8, 14, 20, 24, 26]);
		expect(startsFor(15).map(sheetDayOf)).toEqual([1, 3, 5, 6, 7, 8, 10, 13, 19, 20, 21, 23, 25, 26, 30]);
	});
	it('keeps client/server plan manifests identical', () => {
		expect(readFileSync(new URL('../utils/hizbPlans.ts', import.meta.url), 'utf8')).toBe(
			readFileSync(new URL('../../../../server/src/utils/hizbPlans.ts', import.meta.url), 'utf8')
		);
	});
});
