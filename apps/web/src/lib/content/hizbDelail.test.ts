import { describe, expect, it } from 'vitest';
import { HIZB_BLOCKS, HIZB_SECTIONS } from './hizbulhakaik';
import { splitDelailRepetition } from './hizbDelail';
import { hasDelailRepetition } from '../utils/hizbPlans';
import { planBlocks } from './hizbPlans';

describe('Delail three repetitions', () => {
	it('highlights only the salawat ending at the supplied three marker', () => {
		const original = HIZB_SECTIONS[9].blocks[1];
		const parts = splitDelailRepetition(original)!;
		expect(parts).not.toBeNull();
		expect(parts.passage.lines).toEqual([original.lines[0]]);
		expect(parts.passage.lines[0].text).toMatch(/^\(اَللّٰهُمَّ\) صَلِّ عَلٰى سَيِّدِنَا مُحَمَّدٍ/);
		expect(parts.passage.lines[0].text).toMatch(/اِلٰى يَوْمِ الْحَشْرِ وَ الْقَرَارِ ﴿٣﴾$/);
		expect(parts.after.lines).toEqual([original.lines[1]]);
		expect(parts.after.lines[0].text).toMatch(/^وَ اغْفِرْلَنَا/);
		expect([...parts.passage.lines, ...parts.after.lines]).toEqual(original.lines);
	});
	it('matches one source passage and assigns the requirement only to plans containing it', () => {
		expect(HIZB_BLOCKS.filter(ref => splitDelailRepetition(ref.block))).toHaveLength(1);
		for (const days of [7, 15, 33]) {
			for (let portion = 1; portion <= days; portion++) {
				expect(hasDelailRepetition(days, portion)).toBe(
					planBlocks(days, portion).some(ref => splitDelailRepetition(ref.block) !== null)
				);
			}
		}
	});
});
