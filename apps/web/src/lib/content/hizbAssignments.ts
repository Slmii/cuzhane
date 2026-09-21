import { firstBlockOfSection, HIZB_BLOCKS, HIZB_SECTIONS } from './hizbulhakaik';

/** Assignment reading stops at its section boundary; free reading remains continuous. */
export const hizbReadingBounds = (sectionIndex: number, isAssignment: boolean) => {
	if (!isAssignment) {
		return { first: 0, last: HIZB_BLOCKS.length - 1 };
	}
	const first = firstBlockOfSection(sectionIndex);
	return { first, last: first + (HIZB_SECTIONS[sectionIndex]?.blocks.length ?? 1) - 1 };
};
