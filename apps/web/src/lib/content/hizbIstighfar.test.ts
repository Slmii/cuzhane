import { describe, expect, it } from 'vitest';
import { HIZB_SECTIONS, HIZB_BLOCKS } from './hizbulhakaik';
import { splitIstighfar } from './hizbIstighfar';
import { hasIstighfar } from '../utils/hizbPlans';

describe('opening istighfar', () => {
	it('highlights only the exact final sentence before the supplied repetition marker', () => {
		const original = HIZB_SECTIONS[0].blocks[0];
		const result = splitIstighfar(original)!;
		expect(result.sentence.text).toBe(
			'اَسْتَغْفِرُ اللّٰهَ الْعَظٖيمَ الْكَرٖيمَ الَّذٖى لَٓا اِلٰهَ اِلَّا  هُوَ الْحَىُّ الْقَّيُّومُ وَ اَتُوبُ اِلَيْهِ سُبْحَانَهُ'
		);
		expect(result.introduction.lines).toEqual(original.lines.slice(0, 3));
		expect(result.marker.text).toBe('﴾١١–٣٣–١٠٠﴿');
		expect([...result.introduction.lines, result.sentence, result.marker]).toEqual(original.lines);
	});
	it('never treats an ordinary numbered verse or another prayer as this repetition instruction', () => {
		expect(HIZB_BLOCKS.filter(ref => splitIstighfar(ref.block))).toHaveLength(1);
		expect(splitIstighfar({ lines: [{ page: 5, text: 'Text ﴿١﴾' }] })).toBeNull();
	});
	it('requires istighfar only in the first portion of every plan', () => {
		for (const days of [7, 15, 33]) {
			expect(Array.from({ length: days }, (_, i) => i + 1).filter(p => hasIstighfar(days, p))).toEqual([1]);
		}
	});
});
