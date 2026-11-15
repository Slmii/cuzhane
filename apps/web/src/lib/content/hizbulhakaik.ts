import { BISMILLAH } from './cevsen';
import hizbData from './hizbulhakaik.data.json';
import type { HizbBlock, HizbLine, HizbSection } from './hizbulhakaik.parse';

export type { HizbBlock, HizbLine, HizbSection };

type HizbData = {
	sections: HizbSection[];
};

const data = hizbData as unknown as HizbData;
const CEVSEN_TITLE = 'Cevşen-ül Kebir';
const INVOCATION_MARK = '❁';
/** The superscript alef — the one mark the Delâil's besmele is written without. */
const SUPERSCRIPT_ALEF = /ٰ/gu;
const besmeleShape = BISMILLAH.replace(SUPERSCRIPT_ALEF, '');

/** A besmele on its own line — the Delâil's spelling, without the superscript alef, too. */
export const isBesmele = (line: HizbLine) => line.text.replace(SUPERSCRIPT_ALEF, '') === besmeleShape;

/**
 * A section as the readers take it. Its opening name lines are flagged — every section but
 * Haşir's opens on its name, the Delâil's twice — so they can be left undrawn without moving any
 * line. And each line carries the count of its section's ❁ before it, except in the
 * Cevşen-ül Kebir, whose marks stay unnumbered.
 */
const prepared = (section: HizbSection): HizbSection => {
	const opening = section.blocks[0]?.lines ?? [];
	const name = opening[0] && !isBesmele(opening[0]) ? opening[0].text : null;
	const isNumbered = section.title !== CEVSEN_TITLE;
	let marks = 0;
	let isOpening = true;

	return {
		...section,
		blocks: section.blocks.map(block => ({
			lines: block.lines.map(line => {
				const isSectionName = isOpening && line.text === name;
				const shaped: HizbLine = {
					...line,
					...(isNumbered ? { marksBefore: marks } : {}),
					...(isSectionName ? { isSectionName: true } : {})
				};

				isOpening = isSectionName;
				marks += line.text.split(INVOCATION_MARK).length - 1;

				return shaped;
			})
		}))
	};
};

/**
 * The seventeen sections of the Hizb-ül Hakaik, in the order of the print — see the data
 * file's `meta` for its shape and provenance, and `hizbulhakaik.parse.ts` for the markup.
 *
 * Read by index: unlike the Cevşen's babs nothing here is numbered in the source, and the
 * order is the one thing the print does fix.
 */
export const HIZB_SECTIONS: HizbSection[] = data.sections.map(prepared);

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

/**
 * Whether a section is the Cevşen-ül Kebir, whose blocks are babs closing on the sübhâneke
 * refrain — the one thing `HizbBody` needs to know about where a block came from. Both readers
 * ask, the free one of a section and the group's of a portion's blocks.
 */
export const isCevsenSection = (sectionIndex: number): boolean => HIZB_SECTIONS[sectionIndex]?.title === CEVSEN_TITLE;
