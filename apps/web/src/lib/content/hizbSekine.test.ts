import { describe, expect, it } from 'vitest';
import { BISMILLAH } from './cevsen';
import { HIZB_BLOCKS, HIZB_SECTIONS } from './hizbulhakaik';
import { hasSekine } from '../utils/hizbPlans';
import { planBlocks } from './hizbPlans';
import { portionBlocks } from './hizbPortions';
import { splitSekine } from './hizbSekine';

// Every expectation reads the source's own lines — no Arabic is typed here.
describe('Sekine nineteen repetitions', () => {
	it('repeats from the besmele to the end, as the book’s own instruction says', () => {
		const original = HIZB_SECTIONS[10].blocks[0];
		const parts = splitSekine(original)!;
		expect(parts).not.toBeNull();
		// Not recited: the title. Read once: the opening takbirs, the line before the besmele.
		expect(parts.title.lines).toEqual([original.lines[0]]);
		expect(parts.opening.lines).toEqual([original.lines[1]]);
		// Repeated: from the besmele to the last recited line.
		expect(parts.repeated.lines[0].text).toBe(BISMILLAH);
		expect(parts.repeated.lines).toEqual(original.lines.slice(2, -1));
		// Not recited: the instruction itself, the one line naming the nineteen.
		expect(parts.instruction.lines).toEqual([original.lines.at(-1)]);
		expect(parts.instruction.lines[0].text).toContain('١٩');
		expect(parts.repeated.lines.some(line => line.text.includes('١٩'))).toBe(false);
		expect([
			...parts.title.lines,
			...parts.opening.lines,
			...parts.repeated.lines,
			...parts.instruction.lines
		]).toEqual(original.lines);
	});

	it('matches the one Sekine block and nothing else', () => {
		expect(HIZB_BLOCKS.filter(ref => splitSekine(ref.block))).toHaveLength(1);
	});

	// A reader showing the counter must hand over the whole block, or the cut finds nothing.
	it('is found on every page that counts Sekine', () => {
		expect(portionBlocks(19).some(ref => splitSekine(ref.block) !== null)).toBe(true);
		for (const days of [7, 15, 32]) {
			for (let day = 1; day <= days; day++) {
				expect(planBlocks(days, day).some(ref => splitSekine(ref.block) !== null)).toBe(hasSekine(days, day));
			}
		}
	});
});
