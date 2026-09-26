import { describe, expect, it } from 'vitest';
import { HIZB_BLOCKS, HIZB_SECTIONS, type HizbLine } from './hizbulhakaik';
import {
	HIZB_PORTION_COUNT,
	HIZB_PORTIONS,
	HIZB_WORKS,
	portion,
	portionBlocks,
	workOf,
	worksForParts,
	type HizbAnchor
} from './hizbPortions';

/*
 * The manifest against the text it points into. Every Arabic string below was copied out of
 * `hizbulhakaik.data.json` by script, never typed: the data sets shadda before its vowel, which
 * is not Unicode's canonical order, so a prefix that passed through anything normalising would
 * look identical and still fail a byte comparison.
 */

const MARK = '❁';
const CEVSEN_SECTION = 7;

const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, index) => first + index);

const lineAt = ({ section, block = 0, line = 0 }: HizbAnchor): HizbLine => {
	const found = HIZB_SECTIONS[section]?.blocks[block]?.lines[line];

	if (!found) {
		throw new Error(`No line at ${section}/${block}/${line}`);
	}

	return found;
};

const positionOf = ({ section, block = 0, line = 0, invocation = 0 }: HizbAnchor) => [section, block, line, invocation];

const isBefore = (a: number[], b: number[]) => {
	const index = a.findIndex((value, at) => value !== b[at]);

	return index !== -1 && (a[index] ?? 0) < (b[index] ?? 0);
};

/** Every line of a portion, with the block it was cut from. */
const linesOf = (number: number) =>
	portionBlocks(number).flatMap(({ block, blockIndex, sectionIndex }) =>
		block.lines.map(line => ({ blockIndex, line, number, sectionIndex }))
	);

/** What the data holds at each portion's start: the first words of its first line. */
const OPENINGS: Record<number, string> = {
	1: 'حِزْبُ اَنْوَارِ',
	2: 'سُورَةُ الْفَتْحِ',
	3: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ',
	4: 'جَوْشَنُ الْكَبٖيرْ',
	5: 'فَاَسْئَلُكَ بِاَسْمآَئِكَ',
	6: 'يَا مَنْ هُوَ فِى',
	7: 'يَا مَنْ يَعْلَمُ',
	8: 'يَا مَنْ يَخْلُقُ',
	9: 'اَوْرَادِ قُدْسِيَّه',
	10: 'اَللّٰهُ لَٓا اِلٰهَ اِلَّا',
	11: 'مَرْحَبًا مَرْحَبًا بِالصَّبَاحِ',
	12: 'طٰسٓمٓ',
	13: 'اَلصَّابِرٖينَ',
	14: 'دَلَائِلُ النُّورِ',
	15: '(اَللّٰهُمَّ) صَلِّ عَلٰى سَيِّدِنَا مُحَمَّدٍ شَجَرَةِ',
	16: '(اَللّٰهُمَّ) صَلِّ عَلٰى مَنْ مِنْهُ انْشَقَّتِ',
	17: '(اَللّٰهُمَّ) صَلِّ صَلَاةً كَامِلَةً',
	18: '(اَللّٰهُمَّ) صَلِّ عَلٰى سَيِّدِنَا مُحَمَّدٍ ۨالسَّابِقِ',
	19: 'سَكٖينَه',
	20: 'مُنَاجَاتُ وَيْسَ',
	21: 'مُنَاجَاتُ الْقُرْاٰنْ',
	22: '(اِبْرَاهٖيم:)',
	23: '(لُقْمَان:)',
	24: '(قَمَر:)',
	25: '(نَبَاُالْعَظٖيم:)',
	26: 'تَحْمِيدِيَه',
	27: 'خُلَاصَةُ الْخُلَاصَه',
	28: 'لَٓا اِلٰهَ اِلَّا  اللّٰهُ بِاَلْسِنَةِ',
	29: 'لَٓا اِلٰهَ اِلَّا  اللّٰهُ الْوَاجِبُ',
	30: 'لَٓا اِلٰهَ اِلَّا  اللّٰهُ الْمَلِكُ',
	31: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحٖيمِ',
	32: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحٖيمِ',
	33: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحٖيمِ'
};

describe('HIZB_PORTIONS', () => {
	it('numbers thirty-three portions in order', () => {
		expect(HIZB_PORTION_COUNT).toBe(33);
		expect(HIZB_PORTIONS.map(part => part.number)).toEqual(range(1, 33));
	});

	it('gives the ten works one run each, covering 1–33 with no gap and no overlap', () => {
		expect(HIZB_WORKS.map(work => work.key)).toEqual([
			'quran',
			'cevsen',
			'evrad',
			'delail',
			'sekine',
			'munacatIsmiAzam',
			'munacatQuran',
			'tahmidiye',
			'hulasa',
			'tazarru'
		]);
		expect(HIZB_WORKS.flatMap(({ parts: [first, last] }) => range(first, last))).toEqual(range(1, 33));
		HIZB_PORTIONS.forEach(part => {
			const [first, last] = workOf(part.number).parts;

			expect(part.number >= first && part.number <= last).toBe(true);
			expect(part.work).toBe(workOf(part.number).key);
		});
	});

	it('starts every portion strictly after the one before it', () => {
		HIZB_PORTIONS.slice(1).forEach((part, index) => {
			const previous = HIZB_PORTIONS[index];

			expect(previous && isBefore(positionOf(previous.start), positionOf(part.start))).toBe(true);
		});
	});

	it('has an opening pinned for every portion', () => {
		expect(Object.keys(OPENINGS).map(Number)).toEqual(range(1, 33));
	});

	it.each(range(1, 33))('opens portion %i on the text at its anchor', number => {
		const opening = OPENINGS[number] ?? '';

		expect(linesOf(number)[0]?.line.text.slice(0, opening.length)).toBe(opening);
	});

	it('asks for Sekine nineteen times and every other portion once', () => {
		// Mirrors REQUIRED_REPETITIONS.HIZB in apps/server/src/utils/groupKinds.ts.
		const repeated = Object.fromEntries(
			HIZB_PORTIONS.filter(part => part.repetitions !== undefined).map(part => [part.number, part.repetitions])
		);

		expect(repeated).toEqual({ 19: 19 });
		expect(portion(19).repetitions).toBe(19);
	});
});

describe('portionBlocks', () => {
	it('slices the whole text into the portions, nothing lost and nothing read twice', () => {
		const placed = HIZB_PORTIONS.flatMap(part => {
			const lines = linesOf(part.number);

			return lines.map((entry, index) => ({
				...entry,
				isFirst: index === 0,
				isLast: index === lines.length - 1
			}));
		});
		const source = HIZB_BLOCKS.flatMap(({ block, blockIndex, sectionIndex }) =>
			block.lines.map(line => ({ blockIndex, line, sectionIndex }))
		);
		const cutsOpening: number[] = [];
		let cursor = 0;

		source.forEach(({ blockIndex, line, sectionIndex }) => {
			const head = placed[cursor];

			expect(head && [head.sectionIndex, head.blockIndex]).toEqual([sectionIndex, blockIndex]);

			if (head?.line.text === line.text) {
				expect(head.line).toEqual(line);
				cursor += 1;
				return;
			}

			// A cut line: its head closes one portion and its tail opens the next, in the same block.
			const tail = placed[cursor + 1];

			expect(head?.isLast && tail?.isFirst && tail.number === head.number + 1).toBe(true);
			expect(tail && [tail.sectionIndex, tail.blockIndex]).toEqual([sectionIndex, blockIndex]);

			const headText = head?.line.text ?? '';
			const tailText = tail?.line.text ?? '';
			const separator = line.text.slice(headText.length, line.text.length - tailText.length);

			// Byte for byte: the head is the line's start, the tail its end, and between them is
			// exactly one ❁ with the source's own whitespace around it — nothing else dropped.
			expect(headText + separator + tailText).toBe(line.text);
			expect(separator.trim()).toBe(MARK);
			expect(headText).toBe(headText.trim());
			expect(tailText).toBe(tailText.trim());
			expect([head?.line.page, tail?.line.page]).toEqual([line.page, line.page]);
			expect([...(head?.line.invocations ?? []), ...(tail?.line.invocations ?? [])]).toEqual(line.invocations);

			cutsOpening.push(tail?.number ?? 0);
			cursor += 2;
		});

		expect(cursor).toBe(placed.length);
		expect(cutsOpening).toEqual([10, 11, 13]);
	});

	it('cuts a line only at a ❁ that separates two invocations', () => {
		const midLine = HIZB_PORTIONS.filter(part => (part.start.invocation ?? 0) > 0);

		expect(midLine.map(part => part.number)).toEqual([10, 11, 13]);
		midLine.forEach(({ start }) => {
			const line = lineAt(start);
			const invocation = start.invocation ?? 0;
			const parts = line.text.split(MARK);
			// The one line the source ends with a ❁ that closes nothing (Evrâd-ı Kudsiyye, page 106 —
			// see hizbulhakaik.test.ts) carries as many marks as invocations; every other line one fewer.
			const endsOnMark = parts[parts.length - 1]?.trim() === '';

			expect(parts.length - 1).toBe((line.invocations?.length ?? 0) - (endsOnMark ? 0 : 1));
			// No empty part before the cut, so the Nth ❁ in the text is the one before invocation N.
			expect(parts.slice(0, invocation + 1).map(part => part.trim())).toEqual(
				line.invocations?.slice(0, invocation + 1)
			);
		});
		expect(lineAt(portion(13).start).text.endsWith(MARK)).toBe(true);
	});

	it('keeps invocations on a line exactly when its text still has a ❁', () => {
		HIZB_PORTIONS.flatMap(part => linesOf(part.number)).forEach(({ line }) => {
			expect(line.invocations !== undefined).toBe(line.text.includes(MARK));
		});
	});

	it('keeps the place of each block in the text, so the reader still knows its section', () => {
		expect(portionBlocks(4).every(ref => ref.sectionIndex === CEVSEN_SECTION)).toBe(true);
		expect(portionBlocks(1).map(ref => ref.sectionIndex)).toEqual([0, 1]);
		expect(portionBlocks(20).map(ref => ref.sectionIndex)).toEqual([11, 12, 13]);
	});

	it('puts the hundred closings of the Cevşen in five runs, each in one portion only', () => {
		const toLatin = (mark: string) => Number([...mark].map(digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)).join(''));
		const closingsOf = (number: number) =>
			linesOf(number)
				.filter(entry => entry.sectionIndex === CEVSEN_SECTION)
				.map(entry => /﴿([٠-٩]+)﴾\s*$/.exec(entry.line.text)?.[1])
				.filter((mark): mark is string => mark !== undefined)
				.map(toLatin);

		expect(closingsOf(4)).toEqual(range(1, 20));
		expect(closingsOf(5)).toEqual(range(21, 41));
		expect(closingsOf(6)).toEqual(range(42, 61));
		expect(closingsOf(7)).toEqual(range(62, 81));
		expect(closingsOf(8)).toEqual(range(82, 100));
		expect(HIZB_PORTIONS.flatMap(part => closingsOf(part.number))).toEqual(range(1, 100));
	});
});

describe('works', () => {
	it('names the work a portion belongs to', () => {
		expect(workOf(33).key).toBe('tazarru');
		expect(workOf(19).key).toBe('sekine');
	});

	it('lists the distinct works of a share in reading order', () => {
		expect(worksForParts([15, 16]).map(work => work.key)).toEqual(['delail']);
		expect(worksForParts([8, 9]).map(work => work.key)).toEqual(['cevsen', 'evrad']);
		expect(worksForParts([9, 8, 4]).map(work => work.key)).toEqual(['cevsen', 'evrad']);
	});

	it('refuses a number the division does not have', () => {
		expect(() => portion(0)).toThrow(RangeError);
		expect(() => portion(34)).toThrow(RangeError);
		expect(() => workOf(1.5)).toThrow(RangeError);
		expect(() => portionBlocks(34)).toThrow(RangeError);
	});
});
