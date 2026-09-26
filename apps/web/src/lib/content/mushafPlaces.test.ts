import {
	cuzSections,
	firstVerseAt,
	foldName,
	matchSuras,
	pageNumberAt,
	pageTotalFor,
	parseGoQuery,
	placeOfPage,
	placeOfVerse,
	searchQuran,
	suraEntries
} from '@/lib/content/mushafPlaces';
import { describe, expect, it } from 'vitest';

/*
 * The numbers the design (Q5n / Q5j / Q5p) prints are the typeset Madinah ones, so they double as
 * expectations: Sebe’ opens on 428, Yâsîn on 440, cüz 22 on 422.
 */
describe('the typeset pagination', () => {
	it('numbers its pages as printed', () => {
		expect(pageTotalFor('text')).toBe(604);
	});

	it('finds where a sura starts', () => {
		expect(placeOfVerse({ ayah: 1, chapter: 34 }, 'text')?.pageNumber).toBe(428);
		expect(placeOfVerse({ ayah: 1, chapter: 36 }, 'text')?.pageNumber).toBe(440);
		expect(placeOfVerse({ ayah: 1, chapter: 32 }, 'text')?.pageNumber).toBe(415);
	});

	it('opens a page in its cüz, at the right index', () => {
		const place = placeOfPage(440, 'text');

		expect(place?.cuzNumber).toBe(22);
		expect(place && pageNumberAt(place.cuzNumber, place.pageIndex, 'text')).toBe(440);
		// Yâsîn begins on 440, but below Fâtır's last ayah, which opens the page.
		expect(place && firstVerseAt(place.cuzNumber, place.pageIndex, 'text')).toMatchObject({
			ayah: 45,
			chapter: 35
		});
	});

	it('gives a page shared by two cüz to the one it closes', () => {
		// Page 62 ends cüz 3 and opens cüz 4.
		expect(placeOfPage(62, 'text')?.cuzNumber).toBe(3);
	});

	it('knows nothing outside the mushaf', () => {
		expect(placeOfPage(0, 'text')).toBeUndefined();
		expect(placeOfPage(605, 'text')).toBeUndefined();
		expect(placeOfVerse({ ayah: 55, chapter: 34 }, 'text')).toBeUndefined();
	});

	it('lists a cüz’s sections: its start, then each sura that begins in it', () => {
		const sections = cuzSections(22, 'text');

		expect(sections.map(section => [section.verse.chapter, section.verse.ayah, section.place.pageNumber])).toEqual([
			[33, 31, 422],
			[34, 1, 428],
			[35, 1, 434],
			[36, 1, 440]
		]);
		expect(sections[0]).toMatchObject({ isCuzStart: true, place: { cuzNumber: 22, pageIndex: 0 } });
	});
});

describe('the Hüsrev pagination', () => {
	it('counts its own pages from one', () => {
		expect(pageTotalFor('husrev')).toBe(605);
		expect(placeOfPage(1, 'husrev')).toEqual({ cuzNumber: 1, pageIndex: 0, pageNumber: 1 });
		expect(placeOfPage(606, 'husrev')).toBeUndefined();
	});

	it('finds an ayah on its page, in its own cüz', () => {
		const place = placeOfVerse({ ayah: 1, chapter: 36 }, 'husrev');

		expect(place).toBeDefined();
		expect(place && firstVerseAt(place.cuzNumber, place.pageIndex, 'husrev')?.chapter).toBeLessThanOrEqual(36);
		expect(place && pageNumberAt(place.cuzNumber, place.pageIndex, 'husrev')).toBe(place?.pageNumber);
	});

	it('refuses an ayah the sura does not have', () => {
		expect(placeOfVerse({ ayah: 8, chapter: 1 }, 'husrev')).toBeUndefined();
	});

	it('starts every cüz’s sections on the cüz’s first page', () => {
		for (let cuzNumber = 1; cuzNumber <= 30; cuzNumber++) {
			expect(cuzSections(cuzNumber, 'husrev')[0]?.place).toMatchObject({ cuzNumber, pageIndex: 0 });
		}
	});
});

describe('the sura list', () => {
	it('knows which cüz a sura runs through, in the pagination on screen', () => {
		const text = suraEntries('tr', 'text');

		expect(text[32]).toMatchObject({ ayahCount: 73, chapter: 33, cuzFirst: 21, cuzLast: 22, startPage: 418 });
		expect(text[33]).toMatchObject({ chapter: 34, cuzFirst: 22, cuzLast: 22, name: "Sebe'", startPage: 428 });
		// Câsiye ends in Hüsrev's cüz 26 — the Madinah division keeps all of it in 25.
		expect(suraEntries('tr', 'husrev')[44]).toMatchObject({ chapter: 45, cuzFirst: 25, cuzLast: 26 });
	});

	it('agrees with a walk of every Hüsrev page', () => {
		// The binary search against the plainest possible answer, for every sura's first ayah.
		for (const entry of suraEntries('tr', 'husrev')) {
			const place = placeOfVerse({ ayah: 1, chapter: entry.chapter }, 'husrev');
			const first = place && firstVerseAt(place.cuzNumber, place.pageIndex, 'husrev');

			expect(first && (first.chapter < entry.chapter || first.ayah <= 1)).toBe(true);
		}
	});
});

describe('the search box', () => {
	it('reads an ayah, a page or a name', () => {
		expect(parseGoQuery('34:10')).toEqual({ kind: 'verse', verse: { ayah: 10, chapter: 34 } });
		expect(parseGoQuery(' 34 : 10 ')).toEqual({ kind: 'verse', verse: { ayah: 10, chapter: 34 } });
		expect(parseGoQuery('440')).toEqual({ kind: 'page', pageNumber: 440 });
		expect(parseGoQuery('yasin')).toEqual({ kind: 'name', text: 'yasin' });
		expect(parseGoQuery('   ')).toEqual({ kind: 'none' });
	});

	it('matches a sura without its circumflexes or apostrophe', () => {
		expect(foldName('Yâsîn')).toBe('yasin');
		expect(foldName('Sebe’')).toBe('sebe');
		expect(matchSuras('yasin', 'tr', 'text').map(entry => entry.chapter)).toEqual([36]);
		expect(matchSuras('SEBE', 'tr', 'text').map(entry => entry.chapter)).toContain(34);
	});
});

describe('the search page’s Kur’an section', () => {
	it('finds a sura by name, an ayah by reference and a page by number', () => {
		expect(searchQuran('yasin', 'tr', 'text')).toMatchObject([{ entry: { chapter: 36 }, kind: 'sura' }]);
		expect(searchQuran('34:10', 'tr', 'text')).toMatchObject([
			{ kind: 'ayah', place: { cuzNumber: 22 }, verse: { ayah: 10, chapter: 34 } }
		]);
		expect(searchQuran('440', 'tr', 'text')).toMatchObject([{ first: { ayah: 45, chapter: 35 }, kind: 'page' }]);
	});

	it('finds nothing for an ayah or a page that does not exist', () => {
		expect(searchQuran('34:99', 'tr', 'text')).toEqual([]);
		expect(searchQuran('700', 'tr', 'husrev')).toEqual([]);
		expect(searchQuran('', 'tr', 'text')).toEqual([]);
	});
});
