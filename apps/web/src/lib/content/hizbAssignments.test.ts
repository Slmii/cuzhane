import { describe, expect, it } from 'vitest';
import { firstBlockOfSection, HIZB_SECTIONS } from './hizbulhakaik';
import { hizbReadingBounds } from './hizbAssignments';

describe('assigned Hizb reading bounds', () => {
	it.each(HIZB_SECTIONS.map((_, i) => i))('keeps assigned section %i within its own text', sectionIndex => {
		const bounds = hizbReadingBounds(sectionIndex, true);
		expect(bounds.first).toBe(firstBlockOfSection(sectionIndex));
		expect(bounds.last - bounds.first + 1).toBe(HIZB_SECTIONS[sectionIndex].blocks.length);
	});
	it('keeps free reading able to walk the whole existing book', () => {
		expect(hizbReadingBounds(7, false).first).toBe(0);
		expect(hizbReadingBounds(7, false).last).toBe(HIZB_SECTIONS.reduce((n, s) => n + s.blocks.length, 0) - 1);
	});
});
