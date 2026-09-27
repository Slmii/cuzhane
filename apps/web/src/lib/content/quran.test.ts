import { describe, expect, it } from 'vitest';
import { allCuz, cuzByNumber } from './cuz';
import {
	cuzPages,
	isQuranTextComplete,
	isVerseEnd,
	SAJDAH_VERSE_KEYS,
	verseText,
	wordText,
	type QuranWordItem
} from './quran';

const CUZ_COUNT = 30;
const VERSE_COUNT = 6236;
/** The Madinah mushaf's page count — what every `page` number must fall within. */
const MUSHAF_PAGES = 604;
const LINES_PER_PAGE = 15;

const words = (cuzNumber: number) => cuzPages(cuzNumber).flatMap(page => page.lines.flatMap(line => line.w));

/**
 * The bundled text is held to the bundled metadata: the two were fetched from the same
 * source on different days, and this is where a re-fetch of one that drifted from the other
 * would be caught before a reader met it.
 */
describe('the bundled Kuran text', () => {
	it('holds all thirty cüz and every ayah of the mushaf', () => {
		expect(isQuranTextComplete()).toBe(true);

		const total = Array.from({ length: CUZ_COUNT }, (_, index) =>
			cuzPages(index + 1).reduce((count, page) => count + page.verses.length, 0)
		).reduce((a, b) => a + b, 0);

		expect(total).toBe(VERSE_COUNT);
	});

	it('gives each cüz exactly the pages and ayahs its metadata promises', () => {
		for (const entry of allCuz()) {
			const pages = cuzPages(entry.number);
			const verses = pages.flatMap(page => page.verses);

			expect(pages, `cüz ${entry.number} pages`).toHaveLength(entry.pageCount);
			expect(verses, `cüz ${entry.number} verses`).toHaveLength(entry.verseCount);
			expect(verses.at(0)?.key).toBe(entry.firstVerseKey);
			expect(verses.at(-1)?.key).toBe(entry.lastVerseKey);
		}
	});

	it('numbers pages contiguously through the mushaf, cüz after cüz', () => {
		// Cüz 1 opens on page 1 and cüz 30 closes on 604; between them each cüz's first page
		// is the one after the previous cüz's last — or the same page, where a boundary
		// falls mid-page and both files carry a piece of it.
		let expectedNext = 1;

		for (let cuzNumber = 1; cuzNumber <= CUZ_COUNT; cuzNumber += 1) {
			const pages = cuzPages(cuzNumber);
			const first = pages.at(0)?.page ?? 0;
			const last = pages.at(-1)?.page ?? 0;

			expect([expectedNext - 1, expectedNext]).toContain(first);
			expect(pages.map(page => page.page)).toEqual(Array.from({ length: pages.length }, (_, i) => first + i));
			expectedNext = last + 1;
		}

		expect(expectedNext - 1).toBe(MUSHAF_PAGES);
	});

	it('sets every page on the mushaf’s own lines, in order, within its fifteen', () => {
		for (let cuzNumber = 1; cuzNumber <= CUZ_COUNT; cuzNumber += 1) {
			for (const page of cuzPages(cuzNumber)) {
				const numbers = page.lines.map(line => line.n);

				expect(numbers.length, `page ${page.page}`).toBeGreaterThan(0);
				expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
				expect(new Set(numbers).size).toBe(numbers.length);
				expect(
					numbers.every(n => n >= 1 && n <= LINES_PER_PAGE),
					`page ${page.page}`
				).toBe(true);
				expect(
					page.lines.every(line => line.w.length > 0),
					`page ${page.page}`
				).toBe(true);
			}
		}
	});

	it('closes every verse exactly once, in order', () => {
		// One end per verse, and the ends of a cüz read 1, 2, 3… within each sura — so no verse
		// lost its end marker, and none was split across two.
		for (const entry of allCuz()) {
			const ends = words(entry.number).filter(isVerseEnd);
			const verses = cuzPages(entry.number).flatMap(page => page.verses);

			expect(
				ends.map(end => end.e),
				`cüz ${entry.number}`
			).toEqual(verses.map(verse => verse.ayah));
		}
	});

	it('carries the text of every word, and only in the one encoding', () => {
		for (let cuzNumber = 1; cuzNumber <= CUZ_COUNT; cuzNumber += 1) {
			for (const word of words(cuzNumber)) {
				if (isVerseEnd(word)) {
					continue;
				}

				expect(word.t.trim().length).toBeGreaterThan(0);
				// The Complex's own encoding went with the face that needed it.
				expect(word).not.toHaveProperty('q');
				// Spaces inside a word are the text's own — the one a pause sign or ۩ sits on, and a
				// handful of the source's joined words. A word is one single-line text on the page,
				// so none of them can wrap; see `wordText`.
				expect(wordText(word)).not.toMatch(/[\t\n]/);
			}
		}
	});

	it('marks the first word of every sura the cüz opens', () => {
		for (const entry of allCuz()) {
			const opened = words(entry.number)
				.filter((word): word is QuranWordItem => !isVerseEnd(word) && word.s !== undefined)
				.map(word => word.s);
			const expected = cuzPages(entry.number)
				.flatMap(page => page.verses)
				.filter(verse => verse.ayah === 1)
				.map(verse => verse.chapter);

			expect(opened, `cüz ${entry.number}`).toEqual(expected);
		}
	});

	it('keeps the silent-alef mark as Unicode writes it', () => {
		// قَالُوٓا۟ in 27:56 — the small rounded zero, untouched on its way to the page.
		const line = cuzPages(20)[0]?.lines.find(candidate =>
			candidate.w.some(word => !isVerseEnd(word) && word.t.includes('۟'))
		);
		const word = line?.w.find(
			(candidate): candidate is QuranWordItem => !isVerseEnd(candidate) && candidate.t.includes('۟')
		);

		expect(word).toBeDefined();
		expect(wordText(word!)).toContain('۟');
	});

	it('drops the rub el hizb sign from the display, and only there', () => {
		const first = cuzPages(20)[0]?.lines[0]?.w[0] as QuranWordItem;

		expect(first.t.startsWith('۞')).toBe(true);
		expect(wordText(first)).not.toContain('۞');
	});

	it('opens cüz 22 on Ahzâb 31, at page 422', () => {
		const first = cuzPages(22)[0];

		expect(first?.page).toBe(422);
		expect(first?.verses[0]?.key).toBe('33:31');
		expect(cuzByNumber(22)?.pageCount).toBe(cuzPages(22).length);
	});

	it('lines every page’s verse ends up with its verses, so each word knows its verse', () => {
		for (let cuz = 1; cuz <= CUZ_COUNT; cuz += 1) {
			for (const page of cuzPages(cuz)) {
				const ends = page.lines.flatMap(line => line.w).filter(isVerseEnd);

				// Every end closes the verse listed at its place, and every page ends on one — no verse
				// runs onto the next page in this edition, which `verseText` relies on.
				expect(ends.map(end => end.e)).toEqual(page.verses.map(verse => Number(verse.key.split(':')[1])));
			}
		}
	});

	it('gathers a verse’s words for the meal sheet, across a page break too', () => {
		// Necm 62, the sajdah verse: فَٱسْجُدُوا۟ لِلَّهِ وَٱعْبُدُوا۟ — three words, and the ۩ after the last.
		expect(verseText('53:62').split(' ')).toHaveLength(4);
		expect(verseText('53:62').endsWith(' ۩')).toBe(true);
		// 84:21 — whose end mark the fetch script had to put back after its last word.
		expect(verseText('84:21').split(' ')).toEqual([
			'وَإِذَا',
			'قُرِئَ',
			'عَلَيْهِمُ',
			'ٱلْقُرْءَانُ',
			'لَا',
			'يَسْجُدُونَ',
			'۩'
		]);
		expect(verseText('115:1')).toBe('');
	});

	it('finds the fifteen sajdah verses the edition marks with ۩', () => {
		expect([...SAJDAH_VERSE_KEYS]).toEqual([
			'7:206',
			'13:15',
			'16:50',
			'17:109',
			'19:58',
			'22:18',
			'22:77',
			'25:60',
			'27:26',
			'32:15',
			'38:24',
			'41:38',
			'53:62',
			'84:21',
			'96:19'
		]);
	});
});
