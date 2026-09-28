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
const toReaderMarks = (text: string) => text.replaceAll('۪', 'ٖ');

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
