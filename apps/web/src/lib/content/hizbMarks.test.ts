import { describe, expect, it } from 'vitest';
import { HIZB_SECTIONS, isCevsenSection } from './hizbulhakaik';
import { HIZB_PORTION_COUNT, portionBlocks } from './hizbPortions';
import { splitSekine } from './hizbSekine';

const marksIn = (text: string) => text.split('❁').length - 1;

describe('❁ numbered within their section', () => {
	it('runs on unbroken through every section but the Cevşen-ül Kebir, which stays unnumbered', () => {
		HIZB_SECTIONS.forEach((section, sectionIndex) => {
			const lines = section.blocks.flatMap(block => block.lines);

			if (isCevsenSection(sectionIndex)) {
				expect(lines.every(line => line.marksBefore === undefined)).toBe(true);
				return;
			}

			let expected = 0;

			for (const line of lines) {
				expect(line.marksBefore).toBe(expected);
				expected += marksIn(line.text);
			}
		});
	});

	it('numbers Sekine’s repeated text from 1 to 10', () => {
		const parts = splitSekine(HIZB_SECTIONS[10].blocks[0])!;
		const first = parts.repeated.lines.find(line => marksIn(line.text) > 0)!;
		expect(first.marksBefore).toBe(0);
		expect(parts.repeated.lines.reduce((sum, line) => sum + marksIn(line.text), 0)).toBe(10);
	});

	it('keeps a mark’s number when a portion cuts its line', () => {
		const source = new Map(
			HIZB_SECTIONS.flatMap(section => section.blocks.flatMap(block => block.lines)).map(line => [
				line.text,
				line
			])
		);

		for (let part = 1; part <= HIZB_PORTION_COUNT; part++) {
			for (const ref of portionBlocks(part)) {
				for (const line of ref.block.lines) {
					const whole = source.get(line.text);

					if (line.marksBefore === undefined || whole) {
						continue;
					}

					// A cut piece: find its source line and check where its numbering starts.
					const original = [...source.values()].find(candidate => candidate.text.includes(line.text));
					expect(original, `portion ${part}`).toBeDefined();
					const before = original!.text.slice(0, original!.text.indexOf(line.text));
					// Marks before the piece in its line, the one at a cut included.
					expect(line.marksBefore).toBe(original!.marksBefore! + marksIn(before));
				}
			}
		}
	});
});
