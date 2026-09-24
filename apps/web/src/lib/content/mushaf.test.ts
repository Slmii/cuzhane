import {
	MUSHAF_PAGE_COUNT,
	mushafCuzPages,
	mushafPagePath,
	mushafPageSecde,
	mushafPageSpan
} from '@/lib/content/mushaf';
import { describe, expect, it } from 'vitest';

/*
 * Like `cuz.test.ts`, these hold the **committed file** to what the import script checked when
 * it wrote it — a re-import from a changed app should fail here rather than on a page.
 */
describe('the bundled Hüsrev mushaf data', () => {
	it('holds 605 pages, Fâtiha alone on the first and Nâs closing the last', () => {
		expect(MUSHAF_PAGE_COUNT).toBe(605);
		expect(mushafPageSpan(0)).toEqual({ first: { ayah: 1, chapter: 1 }, last: { ayah: 7, chapter: 1 } });
		expect(mushafPageSpan(604)?.last).toEqual({ ayah: 6, chapter: 114 });
		expect(mushafPageSpan(605)).toBeUndefined();
	});

	it('runs each page on from the one before', () => {
		for (let page = 1; page < MUSHAF_PAGE_COUNT; page += 1) {
			const previous = mushafPageSpan(page - 1)?.last;
			const first = mushafPageSpan(page)?.first;

			// The next ayah of the same sura, or the first of the next one — never a gap or a repeat.
			const isNext =
				(first?.chapter === previous?.chapter && first?.ayah === (previous?.ayah ?? 0) + 1) ||
				(first?.chapter === (previous?.chapter ?? 0) + 1 && first?.ayah === 1);

			expect(isNext, `page ${page}`).toBe(true);
		}
	});

	it('divides the pages into thirty cüz with no gap or overlap', () => {
		const pages = Array.from({ length: 30 }, (_, index) => mushafCuzPages(index + 1)).flat();

		expect(pages).toEqual(Array.from({ length: MUSHAF_PAGE_COUNT }, (_, page) => page));
		expect(mushafCuzPages(31)).toEqual([]);
	});

	it('keeps the edition’s own division — twenty pages a cüz, the first and last longer', () => {
		expect(mushafCuzPages(1)).toHaveLength(21);
		expect(mushafCuzPages(2)).toHaveLength(20);
		expect(mushafCuzPages(30)).toHaveLength(24);
		// Where this edition differs from Madinah: cüz 26 opens at Câsiye 33, not Ahkâf 1.
		expect(mushafPageSpan(mushafCuzPages(26)[0] ?? -1)?.first).toEqual({ ayah: 33, chapter: 45 });
	});

	it('places the fourteen sajdah verses on their own pages, inside the page', () => {
		const secde = Array.from({ length: MUSHAF_PAGE_COUNT }, (_, page) => mushafPageSecde(page)).filter(Boolean);

		expect(secde).toHaveLength(14);
		// Nahl 49, the one the green was first asked about: page 271, the verse starting mid-page.
		expect(mushafPageSecde(271)).toMatchObject({ ayah: 49, sura: 16 });

		for (let page = 0; page < MUSHAF_PAGE_COUNT; page += 1) {
			const entry = mushafPageSecde(page);

			if (entry) {
				// The verse must be one the page actually holds, and its mark must land on the page.
				const span = mushafPageSpan(page);

				expect(entry.sura).toBeGreaterThanOrEqual(span?.first.chapter ?? Infinity);
				expect(entry.sura).toBeLessThanOrEqual(span?.last.chapter ?? -Infinity);
				expect(entry.x).toBeGreaterThan(0);
				expect(entry.x).toBeLessThanOrEqual(1);
				expect(entry.y).toBeGreaterThanOrEqual(0);
				expect(entry.y).toBeLessThan(1);
			}
		}
	});

	it('names each page file by its three-digit number', () => {
		expect(mushafPagePath(0)).toBe('/api/mushaf/page-000.png');
		expect(mushafPagePath(525)).toBe('/api/mushaf/page-525.png');
	});
});
