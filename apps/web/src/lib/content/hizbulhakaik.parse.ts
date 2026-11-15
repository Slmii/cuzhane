/**
 * The Hizb-ül Hakaik, read from the publisher's delimited text — the same markup the Cevşen
 * came in (see `cevsen.data.json`'s `meta`): `#N` is a printed page, `<…>` a section title,
 * `~…|@` one line, `❁` between invocations and `,* * *>` the ornament that closes a du'a.
 *
 * Kept as a pure function so the markup rules can be tested on a few lines; the script that
 * writes `hizbulhakaik.data.json` (`scripts/build-hizbulhakaik.mts`) only feeds it the file.
 */

export type HizbLine = {
	/** The printed page this line is on — pages are not a level of the structure, because a du'a runs across them. */
	page: number;
	text: string;
	/** The line split at its ❁ marks, present only on lines that have any. */
	invocations?: string[];
	/**
	 * How many ❁ of its section come before this line, so each mark can carry its number within
	 * the section. Set when the text loads (`HIZB_SECTIONS`), never in the data file; absent in
	 * the Cevşen-ül Kebir, whose marks stay unnumbered.
	 */
	marksBefore?: number;
	/**
	 * The section's own name, which opens it (twice for the Delâil). Kept in the text so every
	 * position into it stays put, and never drawn: the reader's heading names the section. Set
	 * when the text loads, like `marksBefore`.
	 */
	isSectionName?: boolean;
};

/** What the print closes with `* * *`: a bab of the Cevşen, a du'a, a prayer. */
export type HizbBlock = {
	lines: HizbLine[];
};

export type HizbSection = {
	title: string;
	blocks: HizbBlock[];
};

const PAGE = /^#(\d+)\s*$/;
const TITLE = /^<(.+)>\s*$/;
const LINE = /^~(.*)\|@\s*$/;
const SEPARATOR = /^,\* \* \*>\s*$/;
const INVOCATION_MARK = '❁';

/**
 * The long î. The source writes `U+06EA` (the empty-centre-low-stop, in this edition's
 * convention); the reader's face draws `U+0656` (subscript alef) for it. `cevsen.data.json`
 * made the same swap and says why in `meta.marks`.
 */
const toLongI = (text: string) => text.replaceAll('۪', 'ٖ');

/**
 * Marks the source types on the letter beside the one they belong to — 180 words, nearly all
 * around a lam-alef. The publisher's face draws that pair as one glyph and the file places
 * its marks by eye: the lam's mark goes *before* the lam so it lands on the ligature's right
 * arm, which leaves it on whatever came first — the article's alef, the previous lam, or the
 * space between two words. A face that positions marks by letter then draws exactly what was
 * typed: a sukun on the alef of `ال`, a sukun and a kasra on one lam, a kasra under a gap.
 *
 * Only marks move, never letters, and only where the letter holding one cannot carry it: a
 * vowel beside a sukun, a mark with no letter, a sukun on the article's alef ahead of a lam
 * with none, a shadda on an alef. `يَاْكُلُونَ` and `لَوْلَا` are neither and are left alone.
 * Order matters — the sixth rule tidies what the second leaves behind.
 */
const MISPLACED_MARKS: [RegExp, string][] = [
	// The same mark twice.
	[/([ً-ْ])\1/g, '$1'],
	// A vowel then a sukun, before a lam: the sukun is the lam's.
	[/([ً-ِ])ْل/g, '$1لْ'],
	// A sukun then a vowel, before a lam: the vowel is the lam's.
	[/ْ([َ-ِ])ل/g, 'ْل$1'],
	// A mark with no letter before it, ahead of a lam.
	[/(^|\s)([َ-ِْ])ل/g, '$1ل$2'],
	// The article's alef holding the sukun of a lam that has no mark of its own.
	[/اْل(?![ً-ْٰ])/g, 'الْ'],
	// A lam left with a sukun and a vowel, before an alef: the vowel is the alef's.
	[/لْ([َ-ِ])ا/g, 'لْا$1'],
	// A shadda typed after the alef of a lam-alef is the lam's, with the vowel beside it.
	[/لآَّ/g, 'لَّآ'],
	[/لاًّ/g, 'لًّا']
];

/** Exported for `cevsen.data.json`, which came from the same publisher with the same habits and is held to the same rules. */
export const toReaderMarks = (text: string) =>
	MISPLACED_MARKS.reduce((fixed, [pattern, replacement]) => fixed.replace(pattern, replacement), toLongI(text));

export const parseHizbulhakaik = (source: string): HizbSection[] => {
	const sections: HizbSection[] = [];
	let section: HizbSection | undefined;
	let block: HizbBlock | undefined;
	let page = 0;

	const closeBlock = () => {
		block = undefined;
	};

	source.split('\n').forEach((raw, index) => {
		const lineNumber = index + 1;

		if (raw.trim() === '') {
			return;
		}

		const pageMatch = PAGE.exec(raw);

		if (pageMatch) {
			page = Number(pageMatch[1]);
			return;
		}

		const titleMatch = TITLE.exec(raw);

		if (titleMatch) {
			closeBlock();
			section = { title: titleMatch[1].trim(), blocks: [] };
			sections.push(section);
			return;
		}

		if (SEPARATOR.test(raw)) {
			closeBlock();
			return;
		}

		const lineMatch = LINE.exec(raw);

		if (!lineMatch) {
			throw new Error(`Unrecognised markup on line ${lineNumber}: ${raw}`);
		}

		if (!section) {
			throw new Error(`Text before the first title, on line ${lineNumber}`);
		}

		const text = toReaderMarks(lineMatch[1].trim());
		const line: HizbLine = { page, text };

		if (text.includes(INVOCATION_MARK)) {
			line.invocations = text
				.split(INVOCATION_MARK)
				.map(part => part.trim())
				.filter(part => part !== '');
		}

		if (!block) {
			block = { lines: [] };
			section.blocks.push(block);
		}

		block.lines.push(line);
	});

	return sections;
};
