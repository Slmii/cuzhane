import { describe, expect, it } from 'vitest';
import data from './hizbulhakaik.data.json';
import type { HizbSection } from './hizbulhakaik.parse';

/*
 * The generated file against the source's own census (`scripts/hizbulhakaik.txt`): 17 titles,
 * 723 `~…|@` lines, 242 page markers of which 6 have nothing on them, 1 753 ❁ marks on 345
 * lines, and the Cevşen's hundred closings. Counted independently with grep/awk before the
 * parser existed, so the parser is checked against the text rather than against itself.
 */
const sections = data.sections as HizbSection[];
const allLines = sections.flatMap(section => section.blocks.flatMap(block => block.lines));

describe('hizbulhakaik.data.json', () => {
	it('has the seventeen sections in the order of the print', () => {
		expect(sections.map(section => section.title)).toEqual([
			'Hizb-ü Envâr-ıl Hakâik-ın Nuriye',
			'Yasin Suresi',
			'Fetih Suresi',
			'Rahman Suresi',
			'Haşir Suresinin Ahiri',
			'Tebareke',
			'Nebe',
			'Cevşen-ül Kebir',
			'Evrâd-ı Kudsiyye',
			'Delâil-in Nur',
			'Sekine',
			'Münâcât-ı Veysel Karani',
			"Duâ-i Tercüman-ı İsm-i A'zam",
			"Duâ-i İsm-i A'zam",
			"Münâcât-ül Kur'an",
			'Tahmidiye',
			'Hülasat-ül Hülasa'
		]);
	});

	it('keeps every line of the source', () => {
		expect(allLines).toHaveLength(723);
		expect(allLines.every(line => line.text !== '')).toBe(true);
	});

	it('covers pages 3 to 244, leaving out only the six empty ones', () => {
		const pages = new Set(allLines.map(line => line.page));

		expect(Math.min(...pages)).toBe(3);
		expect(Math.max(...pages)).toBe(244);
		expect(pages.size).toBe(242 - 6);
		[4, 6, 86, 112, 114, 144].forEach(empty => expect(pages.has(empty)).toBe(false));
	});

	it('splits every ❁ line into its invocations and no other', () => {
		const marked = allLines.filter(line => line.text.includes('❁'));

		expect(marked).toHaveLength(345);
		expect(marked.every(line => line.invocations !== undefined)).toBe(true);
		expect(allLines.filter(line => !line.text.includes('❁')).every(line => line.invocations === undefined)).toBe(
			true
		);
		// Each ❁ separates two invocations, so a line has one more than it has marks — except
		// the one line (Evrâd-ı Kudsiyye, page 106) the source ends with a ❁, which closes
		// nothing and yields no empty invocation.
		expect(marked.reduce((sum, line) => sum + (line.invocations?.length ?? 0), 0)).toBe(1753 + 345 - 1);
	});

	it('carries the Cevşen with its hundred closings in order', () => {
		const cevsen = sections.find(section => section.title === 'Cevşen-ül Kebir');
		const closings = (cevsen?.blocks ?? [])
			.flatMap(block => block.lines)
			.map(line => /﴿([٠-٩]+)﴾\s*$/.exec(line.text)?.[1])
			.filter((mark): mark is string => mark !== undefined);
		const toLatin = (mark: string) => Number([...mark].map(digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)).join(''));

		expect(closings.map(toLatin)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
	});

	it('writes the long î the way the reader font expects', () => {
		expect(JSON.stringify(sections)).not.toContain('۪');
		expect(allLines.some(line => line.text.includes('ٖ'))).toBe(true);
	});
});
