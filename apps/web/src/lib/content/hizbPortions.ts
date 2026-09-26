import type { StringKey } from '@/lib/i18n/strings';
import { HIZB_BLOCKS, type HizbBlockRef, type HizbLine } from './hizbulhakaik';

/**
 * The thirty-three portions a Hizb group divides among its seats — the family's revised
 * division, read off the numbered photographs of their book — laid over the text the free
 * reader already has.
 *
 * **The seventeen sections are the print's headings, not the division.** A portion can run
 * across several of them (portion 1 is the opening and Yasin, portion 20 three du'as) or stop
 * inside one — inside a block, and three times inside a single line, at a ❁. So a portion is
 * not a list of sections; it is a place in the text where it begins.
 *
 * **Only starts are stored.** Each portion runs to the next one's start and the last to the
 * end of the text, so the thirty-three cover the whole without a gap or an overlap by
 * construction, and moving one boundary is one edit rather than two that must agree.
 *
 * **No text lives here.** Everything a portion shows is sliced out of
 * `hizbulhakaik.data.json`, which is generated from the publisher's file and never edited by
 * hand — the rules in `hizbulhakaik.ts` apply to every word of it.
 */

/**
 * A place in `hizbulhakaik.data.json`, every index zero-based. `invocation` counts the line's
 * ❁-separated invocations, for a portion that begins partway through a line; a field left
 * out is 0, the start of whatever holds it.
 */
export type HizbAnchor = { section: number; block?: number; line?: number; invocation?: number };

export type HizbWorkKey =
	| 'quran'
	| 'cevsen'
	| 'evrad'
	| 'delail'
	| 'sekine'
	| 'munacatIsmiAzam'
	| 'munacatQuran'
	| 'tahmidiye'
	| 'hulasa'
	| 'tazarru';

/** One of the ten works, and the first and last portion it spans. */
export type HizbWork = { key: HizbWorkKey; titleKey: StringKey; parts: [number, number] };

export type HizbPortion = {
	/** 1–33: the part number a Hizb group's seats, reads and rounds count in. */
	number: number;
	work: HizbWorkKey;
	descriptionKey: StringKey;
	/** Inclusive. The portion runs up to the next one's start; the last, to the end of the text. */
	start: HizbAnchor;
	/** How many times one reader repeats it before it counts as read. Absent means once. */
	repetitions?: number;
};

// Mirrors PART_COUNT.HIZB in apps/server/src/utils/groupKinds.ts — change both together.
export const HIZB_PORTION_COUNT = 33;

export const HIZB_WORKS: HizbWork[] = [
	{ key: 'quran', parts: [1, 3], titleKey: 'hizbWorkQuran' },
	{ key: 'cevsen', parts: [4, 8], titleKey: 'hizbWorkCevsen' },
	{ key: 'evrad', parts: [9, 13], titleKey: 'hizbWorkEvrad' },
	{ key: 'delail', parts: [14, 18], titleKey: 'hizbWorkDelail' },
	{ key: 'sekine', parts: [19, 19], titleKey: 'hizbWorkSekine' },
	{ key: 'munacatIsmiAzam', parts: [20, 20], titleKey: 'hizbWorkMunacatIsmiAzam' },
	{ key: 'munacatQuran', parts: [21, 25], titleKey: 'hizbWorkMunacatQuran' },
	{ key: 'tahmidiye', parts: [26, 26], titleKey: 'hizbWorkTahmidiye' },
	{ key: 'hulasa', parts: [27, 30], titleKey: 'hizbWorkHulasa' },
	{ key: 'tazarru', parts: [31, 33], titleKey: 'hizbWorkTazarru' }
];

/**
 * Where each portion begins, checked on 2026-09-26 against the photographed book's markers.
 * `hizbPortions.test.ts` pins every portion's exact footprint — the blocks it is cut from and
 * the lines in each — and its opening words, long enough that no other block opens with them
 * (the second line too, where the first is the besmele). An anchor edited one block or line
 * off, or a regenerated JSON that moves one, fails there rather than silently handing someone
 * the wrong du'a.
 */
export const HIZB_PORTIONS: HizbPortion[] = [
	{ number: 1, work: 'quran', descriptionKey: 'hizbPart1Desc', start: { section: 0 } },
	{ number: 2, work: 'quran', descriptionKey: 'hizbPart2Desc', start: { section: 2 } },
	{ number: 3, work: 'quran', descriptionKey: 'hizbPart3Desc', start: { section: 4 } },
	{ number: 4, work: 'cevsen', descriptionKey: 'hizbPart4Desc', start: { section: 7, block: 0 } },
	{ number: 5, work: 'cevsen', descriptionKey: 'hizbPart5Desc', start: { section: 7, block: 18 } },
	{ number: 6, work: 'cevsen', descriptionKey: 'hizbPart6Desc', start: { section: 7, block: 39 } },
	{ number: 7, work: 'cevsen', descriptionKey: 'hizbPart7Desc', start: { section: 7, block: 59 } },
	{ number: 8, work: 'cevsen', descriptionKey: 'hizbPart8Desc', start: { section: 7, block: 79 } },
	{ number: 9, work: 'evrad', descriptionKey: 'hizbPart9Desc', start: { section: 8 } },
	{
		number: 10,
		work: 'evrad',
		descriptionKey: 'hizbPart10Desc',
		start: { section: 8, block: 0, line: 8, invocation: 2 }
	},
	{
		number: 11,
		work: 'evrad',
		descriptionKey: 'hizbPart11Desc',
		start: { section: 8, block: 0, line: 12, invocation: 9 }
	},
	{ number: 12, work: 'evrad', descriptionKey: 'hizbPart12Desc', start: { section: 8, block: 0, line: 17 } },
	{
		number: 13,
		work: 'evrad',
		descriptionKey: 'hizbPart13Desc',
		start: { section: 8, block: 0, line: 21, invocation: 2 }
	},
	{ number: 14, work: 'delail', descriptionKey: 'hizbPart14Desc', start: { section: 9 } },
	{ number: 15, work: 'delail', descriptionKey: 'hizbPart15Desc', start: { section: 9, block: 4 } },
	{ number: 16, work: 'delail', descriptionKey: 'hizbPart16Desc', start: { section: 9, block: 7 } },
	{ number: 17, work: 'delail', descriptionKey: 'hizbPart17Desc', start: { section: 9, block: 10 } },
	{ number: 18, work: 'delail', descriptionKey: 'hizbPart18Desc', start: { section: 9, block: 18 } },
	// Mirrors REQUIRED_REPETITIONS.HIZB in apps/server/src/utils/groupKinds.ts — change both together.
	{ number: 19, work: 'sekine', descriptionKey: 'hizbPart19Desc', start: { section: 10 }, repetitions: 19 },
	{ number: 20, work: 'munacatIsmiAzam', descriptionKey: 'hizbPart20Desc', start: { section: 11 } },
	{ number: 21, work: 'munacatQuran', descriptionKey: 'hizbPart21Desc', start: { section: 14, block: 0 } },
	{ number: 22, work: 'munacatQuran', descriptionKey: 'hizbPart22Desc', start: { section: 14, block: 12 } },
	{ number: 23, work: 'munacatQuran', descriptionKey: 'hizbPart23Desc', start: { section: 14, block: 26 } },
	{ number: 24, work: 'munacatQuran', descriptionKey: 'hizbPart24Desc', start: { section: 14, block: 42 } },
	{ number: 25, work: 'munacatQuran', descriptionKey: 'hizbPart25Desc', start: { section: 14, block: 60 } },
	{ number: 26, work: 'tahmidiye', descriptionKey: 'hizbPart26Desc', start: { section: 15 } },
	{ number: 27, work: 'hulasa', descriptionKey: 'hizbPart27Desc', start: { section: 16, block: 0 } },
	{ number: 28, work: 'hulasa', descriptionKey: 'hizbPart28Desc', start: { section: 16, block: 6 } },
	{ number: 29, work: 'hulasa', descriptionKey: 'hizbPart29Desc', start: { section: 16, block: 16 } },
	{ number: 30, work: 'hulasa', descriptionKey: 'hizbPart30Desc', start: { section: 16, block: 27 } },
	{ number: 31, work: 'tazarru', descriptionKey: 'hizbPart31Desc', start: { section: 16, block: 28, line: 3 } },
	{ number: 32, work: 'tazarru', descriptionKey: 'hizbPart32Desc', start: { section: 16, block: 28, line: 9 } },
	{ number: 33, work: 'tazarru', descriptionKey: 'hizbPart33Desc', start: { section: 16, block: 28, line: 15 } }
];

const unknownPortion = (number: number): never => {
	throw new RangeError(`There is no Hizb portion ${number}; the division runs 1–${HIZB_PORTION_COUNT}.`);
};

/** A part number the division does not have is a bug upstream, not a state to render — it throws. */
export const portion = (number: number): HizbPortion => HIZB_PORTIONS[number - 1] ?? unknownPortion(number);

export const workOf = (number: number): HizbWork => {
	const { work } = portion(number);

	return HIZB_WORKS.find(candidate => candidate.key === work) ?? unknownPortion(number);
};

/** The distinct works a set of portions touches, in reading order — "15–16 · Delâilü’n-Nûr". */
export const worksForParts = (numbers: number[]): HizbWork[] => {
	const keys = new Set(numbers.map(number => portion(number).work));

	return HIZB_WORKS.filter(work => keys.has(work.key));
};

const INVOCATION_MARK = '❁';

/** An anchor as a comparable tuple, the fields it leaves out filled with 0. */
type Position = readonly [section: number, block: number, line: number, invocation: number];

const positionOf = ({ section, block = 0, line = 0, invocation = 0 }: HizbAnchor): Position => [
	section,
	block,
	line,
	invocation
];

/** Orders two places by line alone; which invocations of that line count is decided separately. */
const compareLines = (a: Position, b: Position) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The offset of the `index`-th ❁ in `text` (1-based): the first `index` pieces, rejoined, reach it. */
const markOffset = (text: string, index: number) => text.split(INVOCATION_MARK, index).join(INVOCATION_MARK).length;

/**
 * The part of a line from invocation `from` up to, not including, invocation `to` — `to`
 * undefined meaning the end of the line.
 *
 * **The line's own `text` is cut; it is never rebuilt from `invocations`.** Joining the
 * invocations back with ` ❁ ` is not the source: the spacing around the marks varies in the
 * publisher's file, and thirteen lines would come back different. So the cut is made at the
 * Nth ❁ of the text itself, and `invocations` is sliced at the same index to keep the two in
 * step — which holds only because no cut line has an empty piece before its cut, as the test
 * checks.
 *
 * **The ❁ at a cut belongs to neither side.** It stands between invocation N−1 and N; once
 * those are in different portions there is nothing across the boundary for it to separate, so
 * the head ends on the last word of N−1 and the tail opens on the first word of N. Only the
 * whitespace at the cut edges is trimmed, never a character of the text, so head, that one ❁
 * with its spaces, and tail concatenate back to the source line byte for byte.
 *
 * A half left holding a single invocation has no ❁ in it any more, and so no `invocations`
 * either — the parser's rule, that a line carries them exactly when its text has a mark.
 *
 * Exported for its tests; screens take a portion through `portionBlocks`.
 */
export const cutLine = (line: HizbLine, from: number, to: number | undefined): HizbLine => {
	if (from === 0 && to === undefined) {
		return line;
	}

	const begin = from === 0 ? 0 : markOffset(line.text, from) + INVOCATION_MARK.length;
	const end = to === undefined ? line.text.length : markOffset(line.text, to);
	const piece = line.text.slice(begin, end);
	const trimmedStart = from === 0 ? piece : piece.trimStart();
	const cut: HizbLine = { page: line.page, text: to === undefined ? trimmedStart : trimmedStart.trimEnd() };

	if (line.invocations && cut.text.includes(INVOCATION_MARK)) {
		cut.invocations = line.invocations.slice(from, to);
	}

	return cut;
};

/**
 * Which invocations of the line at `here` fall inside [start, end): `null` for none, otherwise
 * `[from, to]` with `to` undefined for the rest of the line.
 */
const spanOfLine = (
	here: Position,
	start: Position,
	end: Position | undefined
): [number, number | undefined] | null => {
	const sinceStart = compareLines(here, start);

	if (sinceStart < 0) {
		return null;
	}

	const from = sinceStart === 0 ? start[3] : 0;

	if (!end) {
		return [from, undefined];
	}

	const untilEnd = compareLines(here, end);

	if (untilEnd < 0) {
		return [from, undefined];
	}

	return untilEnd === 0 && end[3] > 0 ? [from, end[3]] : null;
};

/**
 * A portion's text, in the block shape `HizbBody` renders, each block keeping its place in the
 * whole — the reader decides what a block is (a Cevşen bab has a refrain) from its section.
 *
 * Lines outside the portion are dropped from a block, and a block left with none is dropped
 * with them. A portion spanning several sections simply returns their blocks in order.
 *
 * **Section and block do not identify a returned block.** Consecutive portions can be cut from
 * the same source block — parts 9–13 all return block 8/0 (the Evrâd is one block), and 30–33
 * all return 16/28 — so a React key needs the portion number beside them.
 */
export const portionBlocks = (number: number): HizbBlockRef[] => {
	const start = positionOf(portion(number).start);
	// `number` is 1-based, so the following portion sits at index `number`.
	const following = HIZB_PORTIONS[number];
	const end = following ? positionOf(following.start) : undefined;

	return HIZB_BLOCKS.flatMap(ref => {
		const lines = ref.block.lines.flatMap((line, lineIndex) => {
			const span = spanOfLine([ref.sectionIndex, ref.blockIndex, lineIndex, 0], start, end);

			return span ? [cutLine(line, ...span)] : [];
		});

		return lines.length > 0 ? [{ ...ref, block: { lines } }] : [];
	});
};
