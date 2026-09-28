import { describe, expect, it } from 'vitest';
import { HIZB_SECTIONS, isBesmele } from './hizbulhakaik';

const allLines = () => HIZB_SECTIONS.flatMap(section => section.blocks.flatMap(block => block.lines));

describe('section names and the besmele', () => {
	it('flags each section’s opening name, and only that', () => {
		const flagged = HIZB_SECTIONS.map(section =>
			section.blocks.flatMap(block => block.lines).filter(line => line.isSectionName)
		);

		// Every section but Haşir's opens on its name; the Delâil's twice.
		expect(flagged.filter(lines => lines.length > 0)).toHaveLength(16);
		expect(flagged[4]).toHaveLength(0);
		expect(flagged[9]).toHaveLength(2);

		HIZB_SECTIONS.forEach((section, index) => {
			const opening = section.blocks[0]!.lines;
			const count = flagged[index]!.length;

			// At the very top of the first block, and nowhere else.
			expect(opening.slice(0, count).every(line => line.isSectionName)).toBe(true);
			expect(opening[count]?.isSectionName).toBeUndefined();
		});
	});

	it('knows every besmele on its own line, the Delâil’s spelling too', () => {
		const besmeles = allLines().filter(isBesmele);
		expect(besmeles).toHaveLength(39);
		expect(besmeles).toContain(HIZB_SECTIONS[9]!.blocks[0]!.lines[2]);
		// "Bismihî sübhânehû" opens the Tahmidiye and is not the besmele.
		expect(isBesmele(HIZB_SECTIONS[15]!.blocks[0]!.lines[1]!)).toBe(false);
	});
});
