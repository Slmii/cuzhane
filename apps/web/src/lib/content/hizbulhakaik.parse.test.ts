import { describe, expect, it } from 'vitest';
import { parseHizbulhakaik } from './hizbulhakaik.parse';

const lines = (...rows: string[]) => rows.join('\n') + '\n';

describe('parseHizbulhakaik', () => {
	it('opens a section at its title and stamps each line with the page it is printed on', () => {
		const sections = parseHizbulhakaik(lines('#8 ', '<Yasin Suresi> ', '~سُورَةُ يٰسٓ|@'));

		expect(sections).toEqual([
			{
				title: 'Yasin Suresi',
				blocks: [{ lines: [{ page: 8, text: 'سُورَةُ يٰسٓ' }] }]
			}
		]);
	});

	it('closes a block at * * * and opens the next one at the following line', () => {
		const [section] = parseHizbulhakaik(lines('#36', '<A>', '~one|@', '~two|@', ',* * *>', '~three|@'));

		expect(section.blocks).toEqual([
			{
				lines: [
					{ page: 36, text: 'one' },
					{ page: 36, text: 'two' }
				]
			},
			{ lines: [{ page: 36, text: 'three' }] }
		]);
	});

	it('lets a block run across a page break', () => {
		// The print sets * * * at the end of a page only 15 times in 242 pages; everywhere else
		// a du'a simply continues on the next page, so the page number belongs to the line.
		const [section] = parseHizbulhakaik(lines('#36', '<A>', '~one|@', '#37', '~two|@'));

		expect(section.blocks).toEqual([
			{
				lines: [
					{ page: 36, text: 'one' },
					{ page: 37, text: 'two' }
				]
			}
		]);
	});

	it('starts a section in the middle of a page', () => {
		// Haşir, Tebareke and Nebe each begin under the previous sura on the same page.
		const sections = parseHizbulhakaik(lines('#26', '<A>', '~a|@', '<B>', '~b|@'));

		expect(sections.map(section => section.title)).toEqual(['A', 'B']);
		expect(sections[1].blocks).toEqual([{ lines: [{ page: 26, text: 'b' }] }]);
	});

	it('splits a line on ❁ into its invocations and keeps the line whole beside them', () => {
		const [section] = parseHizbulhakaik(lines('#35', '<A>', '~يَا اَللّٰهُ ❁ يَا رَحْمٰنُ ❁ يَا رَح۪يمُ|@'));

		expect(section.blocks[0].lines[0]).toEqual({
			page: 35,
			text: 'يَا اَللّٰهُ ❁ يَا رَحْمٰنُ ❁ يَا رَحٖيمُ',
			invocations: ['يَا اَللّٰهُ', 'يَا رَحْمٰنُ', 'يَا رَحٖيمُ']
		});
	});

	it('yields no empty invocation for a ❁ the source leaves at the end of a line', () => {
		// Evrâd-ı Kudsiyye, page 106, is the one line in the text that ends with the mark.
		const [section] = parseHizbulhakaik(lines('#106', '<A>', '~one ❁ two❁|@'));

		expect(section.blocks[0].lines[0].invocations).toEqual(['one', 'two']);
	});

	it('writes the long î as U+0656, as cevsen.data.json does', () => {
		const [section] = parseHizbulhakaik(lines('#5', '<A>', '~الرَّح۪يمِ|@'));

		expect(section.blocks[0].lines[0].text).toBe('الرَّحٖيمِ');
		expect(section.blocks[0].lines[0].text).not.toContain('۪');
	});

	it.each([
		// the lam's sukun typed on the lam before it, the alef's fatha on the lam
		['لِْلَانَامِ', 'لِلْاَنَامِ'],
		// the same with a kasra under the alef
		['لِْلاِنْسَانِ', 'لِلْاِنْسَانِ'],
		// the lam's sukun typed on the article's alef
		['خَلَقَ اْلاِنْسَانَ', 'خَلَقَ الْاِنْسَانَ'],
		// the same before a superscript alef
		['اْلاٰخِرَةِ', 'الْاٰخِرَةِ'],
		// the same before the long î
		['اْلا۪يمَانِ', 'الْاٖيمَانِ'],
		// the same where no alef follows the lam
		['بِاْلقِسْطِ', 'بِالْقِسْطِ'],
		// the lam's kasra typed before it, under the space
		['بَوَّءَ ِلاِبْرَاه۪يمَ', 'بَوَّءَ لِاِبْرَاهٖيمَ'],
		// the lam's fatha typed on the meem before it
		['تَمَْلاُ', 'تَمْلَاُ'],
		// a sukun typed twice
		['الْْمُلْكُ', 'الْمُلْكُ'],
		// the lam's shadda and fatha typed after the alef's madda
		['اِلآَّ', 'اِلَّآ'],
		// the lam's shadda and tanwin typed after the alef
		['كُلاًّ', 'كُلًّا']
	])('puts a mark the source types on the neighbouring letter back on its own: %s', (source, expected) => {
		const [section] = parseHizbulhakaik(lines('#5', '<A>', `~${source}|@`));

		expect(section.blocks[0].lines[0].text).toBe(expected);
	});

	it.each([
		// a sukun that is the waw's, before lâ
		'لَوْلَا',
		// the hamza this edition writes as an alef with sukun
		'يَاْكُلُونَ',
		// an article already typed in order
		'وَالْاَرْضَ',
		// a tanwin on the alef of a lam-alef
		'قَوْلاً',
		// the small noon the print sets between two words
		'مُحَمَّدٍ ۨالنَّبِىِّ'
	])('leaves marks that are already on their letter alone: %s', source => {
		const [section] = parseHizbulhakaik(lines('#5', '<A>', `~${source}|@`));

		expect(section.blocks[0].lines[0].text).toBe(source);
	});

	it('leaves nothing behind for an empty page or a trailing separator', () => {
		const [section] = parseHizbulhakaik(lines('#3', '<A>', '~a|@', ',* * *>', '#4', '#5', '~b|@', ',* * *>'));

		expect(section.blocks).toEqual([{ lines: [{ page: 3, text: 'a' }] }, { lines: [{ page: 5, text: 'b' }] }]);
	});

	it('refuses a line it does not recognise rather than dropping it', () => {
		expect(() => parseHizbulhakaik(lines('#3', '<A>', 'stray text'))).toThrow(/line 3/);
	});

	it('refuses text before the first title', () => {
		expect(() => parseHizbulhakaik(lines('#3', '~a|@'))).toThrow(/before the first title/);
	});
});
