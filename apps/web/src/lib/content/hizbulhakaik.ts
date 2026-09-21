import hizbData from './hizbulhakaik.data.json';
import type { HizbBlock, HizbLine, HizbSection } from './hizbulhakaik.parse';

export type { HizbBlock, HizbLine, HizbSection };

type HizbData = {
	sections: HizbSection[];
};

const data = hizbData as unknown as HizbData;

/**
 * The seventeen sections of the Hizb-ül Hakaik, in the order of the print — see the data
 * file's `meta` for its shape and provenance, and `hizbulhakaik.parse.ts` for the markup.
 *
 * Read by index: unlike the Cevşen's babs nothing here is numbered in the source, and the
 * order is the one thing the print does fix.
 */
export const HIZB_SECTIONS: HizbSection[] = data.sections;

export const getHizbSection = (index: number): HizbSection | undefined => HIZB_SECTIONS[index];

/** The first and last printed page a run of lines touches. */
export const pageRangeOf = (lines: HizbLine[]): { from: number; to: number } => {
	const pages = lines.map(line => line.page);

	return { from: Math.min(...pages), to: Math.max(...pages) };
};

export const sectionPageRange = (section: HizbSection) => pageRangeOf(section.blocks.flatMap(block => block.lines));

/** One block with its place in the whole: the section it belongs to and its index inside it. */
export type HizbBlockRef = {
	block: HizbBlock;
	sectionIndex: number;
	blockIndex: number;
};

/**
 * Every block of the Hizb in reading order, across sections. The reader's cursor walks this
 * list, so "next" at the end of one section is the first block of the following one — the
 * Hizb is read straight through, and the section boundary is a heading, not a wall.
 */
export const HIZB_BLOCKS: HizbBlockRef[] = HIZB_SECTIONS.flatMap((section, sectionIndex) =>
	section.blocks.map((block, blockIndex) => ({ block, blockIndex, sectionIndex }))
);

/** Where a section starts in `HIZB_BLOCKS`; 0 for anything out of range. */
export const firstBlockOfSection = (sectionIndex: number): number =>
	Math.max(
		0,
		HIZB_BLOCKS.findIndex(ref => ref.sectionIndex === sectionIndex)
	);
