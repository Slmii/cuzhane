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
	it('uses the independent 15-day boundaries, including bab 51 and the approved Hulasat split', () => {
		expect(startsFor(15)[2]).toEqual([7, 48, 0, 0]);
		expect(textOf(planBlocks(15, 2))).toContain('﴿٥٠﴾');
		expect(textOf(planBlocks(15, 2))).not.toContain('﴿٥١﴾');
		expect(textOf(planBlocks(15, 3))).toContain('﴿٥١﴾');
		expect(startsFor(15)[13]).toEqual([16, 16, 0, 0]);
	});
	it('keeps client/server plan manifests identical', () => {
		expect(readFileSync(new URL('../utils/hizbPlans.ts', import.meta.url), 'utf8')).toBe(
			readFileSync(new URL('../../../../server/src/utils/hizbPlans.ts', import.meta.url), 'utf8')
		);
	});
});
