import { describe, expect, it } from 'vitest';
import { requiredRepetitions } from '@/lib/utils/groupKinds';
import { HIZB_BLOCKS, HIZB_SECTIONS, type HizbLine } from './hizbulhakaik';
import {
	cutLine,
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

/**
 * What the data holds at each portion's start: the first words of its first line. Where a
 * portion opens a block, long enough that no other block in the text opens with them: blocks
 * of the Hülasa open on the same words for up to 125 characters, so a short prefix would pass
 * for an anchor one block off.
 */
const OPENINGS: Record<number, string> = {
	1: 'حِزْبُ اَنْوَارِ',
	2: 'سُورَةُ الْفَتْحِ',
	3: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحٖيمِ',
	4: 'جَوْشَنُ الْكَبٖيرْ',
	5: 'فَاَسْئَلُكَ بِاَسْمآَئِكَ',
	6: 'وَ اَسْئَلُكَ بِاَسْمَٓائِكَ يَا غَافِرُ',
	7: 'يَا مَنْ يُقَلِّبُ',
	8: 'يَا مَنْ اَنْعَمَ',
	9: 'اَوْرَادِ قُدْسِيَّه',
	10: 'اَللّٰهُ لَٓا اِلٰهَ اِلَّا',
	11: 'مَرْحَبًا مَرْحَبًا بِالصَّبَاحِ',
	12: 'لَٓا اِلٰهَ اِلَّا  اللّٰهُ الْوَكٖيلُ الشَّهٖيدُ',
	13: 'كٓهٰيٰعٓصٓ ❁ حٰمٓ عٓسٓقٓ',
	14: 'دَلَائِلُ النُّورِ',
	15: '(اَللّٰهُمَّ) صَلِّ عَلٰى سَيِّدِنَا مُحَمَّدٍ شَجَرَةِ',
	16: '(اَللّٰهُمَّ) صَلِّ عَلٰى مَنْ مِنْهُ انْشَقَّتِ',
	17: '(اَللّٰهُمَّ) صَلِّ عَلٰى سَيِّدِنَا مُحَمَّدٍ صَلَاةً',
	18: '(اَللّٰهُمَّ) صَلِّ عَلٰى سَيِّدِنَا مُحَمَّدٍ ۨالسَّابِقِ',
	19: 'سَكٖينَه',
	20: 'مُنَاجَاتُ وَيْسَ',
	21: 'مُنَاجَاتُ الْقُرْاٰنْ',
	22: '(اِسْرٰى:)',
	23: '(صَٓافَّات:)',
	24: '(مُنَافِقٖين:) يَا مَنْ لَهُ',
	25: 'تَحْمِيدِيَه',
	26: 'خُلَاصَةُ الْخُلَاصَه',
	27: 'لَٓا اِلٰهَ اِلَّا  اللّٰهُ بِاَلْسِنَةِ الْاَخْيَارِ',
	28: 'لَٓا اِلٰهَ اِلَّا  اللّٰهُ الْوَاجِبُ الْوُجُودِ اَلْوَاحِدُ الْاَحَدُ ذُو',
	29: 'لَٓا اِلٰهَ اِلَّا  اللّٰهُ الْمَلِكُ الْحَقُّ الْمُبٖينُ مُحَمَّدٌ رَسُولُ اللّٰهِ صَادِقُ الْوَعْدِ الْاَمٖينِ بِشَهَادَةِ صَاحِبِ',
	30: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحٖيمِ',
	31: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحٖيمِ',
	32: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحٖيمِ'
};

/**
 * The second line where the first is the besmele, which opens nineteen blocks and three of
 * these portions' mid-block starts besides, and so says nothing about where a portion is.
 */
const SECOND_LINES: Record<number, string> = {
	3: 'لَا يَسْتَوٖٓى اَصْحَابُ',
	30: 'اِلٰهٖى اَلذُّنُوبُ',
	31: 'سُبْحَانَكَ لَٓا',
	32: 'يَٓا اَللّٰهُ ❁ يَا رَحْمٰنُ'
};

/**
 * Each portion's exact footprint, copied out of the data by a script that walked the anchors
 * over the JSON on its own rather than through `portionBlocks`: every block the portion
 * touches as `section/block:lines`, and its line count. The openings say a portion starts on
 * the right words; this says it starts, and stops, in the right block and on the right line.
 */
const FOOTPRINTS: Record<number, { blocks: string; lines: number }> = {
	1: { blocks: '0/0:5 1/0:10', lines: 15 },
	2: { blocks: '2/0:8 3/0:7', lines: 15 },
	3: { blocks: '4/0:3 5/0:6 6/0:8', lines: 17 },
	4: {
		blocks: '7/0:7 7/1:2 7/2:3 7/3:2 7/4:3 7/5:2 7/6:3 7/7:2 7/8:3 7/9:2 7/10:3 7/11:2 7/12:2 7/13:2 7/14:5 7/15:2 7/16:2 7/17:2',
		lines: 49
	},
	5: {
		blocks: '7/18:2 7/19:2 7/20:3 7/21:2 7/22:2 7/23:2 7/24:3 7/25:2 7/26:2 7/27:2 7/28:2 7/29:2 7/30:2 7/31:3 7/32:2 7/33:3 7/34:2 7/35:3 7/36:2 7/37:3',
		lines: 46
	},
	6: {
		blocks: '7/38:2 7/39:3 7/40:2 7/41:3 7/42:2 7/43:2 7/44:2 7/45:2 7/46:2 7/47:2 7/48:3 7/49:2 7/50:3 7/51:2 7/52:2 7/53:2 7/54:3 7/55:2 7/56:3 7/57:2',
		lines: 46
	},
	7: {
		blocks: '7/58:3 7/59:2 7/60:3 7/61:2 7/62:2 7/63:2 7/64:3 7/65:2 7/66:2 7/67:2 7/68:3 7/69:2 7/70:2 7/71:2 7/72:2 7/73:2 7/74:2 7/75:3 7/76:2 7/77:2',
		lines: 45
	},
	8: {
		blocks: '7/78:2 7/79:3 7/80:2 7/81:3 7/82:2 7/83:3 7/84:2 7/85:2 7/86:2 7/87:3 7/88:2 7/89:2 7/90:2 7/91:2 7/92:2 7/93:2 7/94:3 7/95:2 7/96:2 7/97:2 7/98:4',
		lines: 49
	},
	9: { blocks: '8/0:9', lines: 9 },
	10: { blocks: '8/0:5', lines: 5 },
	11: { blocks: '8/0:7', lines: 7 },
	12: { blocks: '8/0:5', lines: 5 },
	13: { blocks: '8/0:5', lines: 5 },
	14: { blocks: '9/0:6 9/1:2 9/2:2 9/3:3', lines: 13 },
	15: { blocks: '9/4:2 9/5:1 9/6:3', lines: 6 },
	16: { blocks: '9/7:3 9/8:2 9/9:1 9/10:1 9/11:1 9/12:1 9/13:1', lines: 10 },
	17: { blocks: '9/14:1 9/15:1 9/16:2 9/17:4', lines: 8 },
	18: { blocks: '9/18:7 9/19:2 9/20:2 9/21:1 9/22:6', lines: 18 },
	19: { blocks: '10/0:14', lines: 14 },
	20: { blocks: '11/0:12 12/0:41 13/0:5', lines: 58 },
	21: {
		blocks: '14/0:8 14/1:2 14/2:2 14/3:2 14/4:2 14/5:2 14/6:1 14/7:1 14/8:2 14/9:1 14/10:2 14/11:2 14/12:1 14/13:2 14/14:1',
		lines: 31
	},
	22: {
		blocks: '14/15:2 14/16:2 14/17:1 14/18:2 14/19:2 14/20:1 14/21:2 14/22:1 14/23:2 14/24:1 14/25:2 14/26:1 14/27:2 14/28:1 14/29:2',
		lines: 24
	},
	23: {
		blocks: '14/30:1 14/31:2 14/32:1 14/33:2 14/34:1 14/35:2 14/36:1 14/37:2 14/38:2 14/39:1 14/40:2 14/41:1 14/42:2 14/43:1 14/44:1 14/45:2 14/46:2 14/47:1 14/48:1',
		lines: 28
	},
	24: {
		blocks: '14/48:1 14/49:1 14/50:1 14/51:2 14/52:1 14/53:1 14/54:2 14/55:1 14/56:1 14/57:1 14/58:2 14/59:1 14/60:2 14/61:1 14/62:2 14/63:1 14/64:1 14/65:2 14/66:1 14/67:1 14/68:2 14/69:1 14/70:1 14/71:1 14/72:2 14/73:1 14/74:1 14/75:1 14/76:1 14/77:2 14/78:1 14/79:1 14/80:1 14/81:2 14/82:1 14/83:1 14/84:1 14/85:1 14/86:2 14/87:1 14/88:1 14/89:1',
		lines: 53
	},
	25: {
		blocks: '15/0:9 15/1:4 15/2:4 15/3:4 15/4:4 15/5:4 15/6:4 15/7:3 15/8:4 15/9:3 15/10:3 15/11:4 15/12:4 15/13:4 15/14:3 15/15:4 15/16:3 15/17:4 15/18:4 15/19:3',
		lines: 79
	},
	26: { blocks: '16/0:8 16/1:2 16/2:1 16/3:2 16/4:1 16/5:2', lines: 16 },
	27: { blocks: '16/6:1 16/7:1 16/8:2 16/9:1 16/10:1 16/11:2 16/12:1 16/13:2 16/14:1 16/15:2', lines: 14 },
	28: {
		blocks: '16/16:1 16/17:1 16/18:1 16/19:2 16/20:1 16/21:1 16/22:1 16/23:2 16/24:1 16/25:1 16/26:4',
		lines: 16
	},
	29: { blocks: '16/27:2 16/28:3', lines: 5 },
	30: { blocks: '16/28:6', lines: 6 },
	31: { blocks: '16/28:6', lines: 6 },
	32: { blocks: '16/28:9', lines: 9 }
};

describe('HIZB_PORTIONS', () => {
	it('numbers thirty-two portions in order', () => {
		expect(HIZB_PORTION_COUNT).toBe(32);
		expect(HIZB_PORTIONS.map(part => part.number)).toEqual(range(1, 32));
	});

	it('gives the ten works one run each, covering 1–32 with no gap and no overlap', () => {
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
		expect(HIZB_WORKS.flatMap(({ parts: [first, last] }) => range(first, last))).toEqual(range(1, 32));
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
		expect(Object.keys(OPENINGS).map(Number)).toEqual(range(1, 32));
	});

	it.each(range(1, 32))('opens portion %i on the text at its anchor', number => {
		const opening = OPENINGS[number] ?? '';

		expect(linesOf(number)[0]?.line.text.slice(0, opening.length)).toBe(opening);
	});

	it.each([3, 30, 31, 32])('follows the besmele of portion %i with its own second line', number => {
		const second = SECOND_LINES[number] ?? '';

		expect(linesOf(number)[0]?.line.text).toBe(OPENINGS[number]);
		expect(linesOf(number)[1]?.line.text.slice(0, second.length)).toBe(second);
	});

	it('opens every block-start portion on words no other block in the text opens with', () => {
		const atBlockStart = HIZB_PORTIONS.filter(part => (part.start.line ?? 0) === 0 && !part.start.invocation);

		expect(atBlockStart).toHaveLength(24);
		atBlockStart.forEach(({ number }) => {
			const opening = OPENINGS[number] ?? '';
			const second = SECOND_LINES[number];
			const matches = HIZB_BLOCKS.filter(
				({ block: { lines } }) =>
					lines[0]?.text.startsWith(opening) && (second === undefined || lines[1]?.text.startsWith(second))
			);

			expect(matches, `portion ${number}`).toHaveLength(1);
		});
	});

	it.each(range(1, 32))('cuts portion %i out of exactly the blocks and lines pinned for it', number => {
		const refs = portionBlocks(number);

		expect({
			blocks: refs.map(ref => `${ref.sectionIndex}/${ref.blockIndex}:${ref.block.lines.length}`).join(' '),
			lines: refs.reduce((sum, ref) => sum + ref.block.lines.length, 0)
		}).toEqual(FOOTPRINTS[number]);
	});

	it('pins footprints that add up to the whole text plus the three lines cut in two', () => {
		expect(Object.values(FOOTPRINTS).reduce((sum, footprint) => sum + footprint.lines, 0)).toBe(724 + 3);
	});

	it('asks for Sekine nineteen times and every other portion once', () => {
		// Mirrors REQUIRED_REPETITIONS.HIZB in apps/server/src/utils/groupKinds.ts.
		const repeated = Object.fromEntries(
			HIZB_PORTIONS.filter(part => part.repetitions !== undefined).map(part => [part.number, part.repetitions])
		);

		expect(repeated).toEqual({ 19: 19 });
		expect(portion(19).repetitions).toBe(19);
	});

	it('agrees with the group side about every portion’s count of repetitions', () => {
		HIZB_PORTIONS.forEach(part => {
			expect(part.repetitions ?? 1, `portion ${part.number}`).toBe(requiredRepetitions('HIZB', part.number));
		});
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
	});

	it('keeps invocations on a line exactly when its text still has a ❁', () => {
		HIZB_PORTIONS.flatMap(part => linesOf(part.number)).forEach(({ line }) => {
			expect(line.invocations !== undefined).toBe(line.text.includes(MARK));
		});
	});

	it('drops invocations from a cut half left with no ❁, as the parser would never have set them', () => {
		// No manifest cut does this today; a cut after the first invocation or before the last would.
		const line = lineAt(portion(10).start);
		const invocations = line.invocations ?? [];
		const last = invocations.length - 1;

		// Each half keeps its marks' numbers within the section: the tail starts `last` marks on.
		expect(cutLine(line, 0, 1)).toStrictEqual({
			marksBefore: line.marksBefore,
			page: line.page,
			text: invocations[0]
		});
		expect(cutLine(line, last, undefined)).toStrictEqual({
			marksBefore: line.marksBefore! + last,
			page: line.page,
			text: invocations[last]
		});
		expect(cutLine(line, 1, last).invocations).toEqual(invocations.slice(1, last));
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
		expect(closingsOf(5)).toEqual(range(21, 40));
		expect(closingsOf(6)).toEqual(range(41, 60));
		expect(closingsOf(7)).toEqual(range(61, 80));
		expect(closingsOf(8)).toEqual(range(81, 100));
		expect(HIZB_PORTIONS.flatMap(part => closingsOf(part.number))).toEqual(range(1, 100));
	});
});

describe('works', () => {
	it('names the work a portion belongs to', () => {
		expect(workOf(32).key).toBe('tazarru');
		expect(workOf(19).key).toBe('sekine');
	});

	it('lists the distinct works of a share in reading order', () => {
		expect(worksForParts([15, 16]).map(work => work.key)).toEqual(['delail']);
		expect(worksForParts([8, 9]).map(work => work.key)).toEqual(['cevsen', 'evrad']);
		expect(worksForParts([9, 8, 4]).map(work => work.key)).toEqual(['cevsen', 'evrad']);
	});

	it('refuses a number the division does not have', () => {
		expect(() => portion(0)).toThrow(RangeError);
		expect(() => portion(33)).toThrow(RangeError);
		expect(() => workOf(1.5)).toThrow(RangeError);
		expect(() => portionBlocks(33)).toThrow(RangeError);
	});
});
