import data from './mushaf.data.json';

/**
 * Hayrât Neşriyat's Ahmed Hüsrev hattı Tevâfuklu Kur'ân-ı Kerîm, **used with Hayrat Vakfı's
 * written permission** — what the cüz reader shows when "Hüsrev hattı" is chosen.
 *
 * The pages themselves are images, served at `/mushaf/page-NNN.png` and kept on the device once
 * read (`useMushafPage`). This is the small part that is bundled: which ayahs each page holds
 * and which pages each cüz spans, generated from the publisher's own database by
 * `apps/server/scripts/import-hayrat-mushaf.ts` — never edited by hand.
 *
 * **Pages count from 0**, as that database does: 0 is Fâtiha on its own framed page. **Its cüz
 * are its own**, twenty whole pages each, so eight of them start or end a few ayahs away from
 * the Madinah cüz in `cuz.data.json` — the page in front of the reader is the edition's, and so
 * is its division.
 */

export type MushafVerse = { chapter: number; ayah: number };

/** The first and last ayah a page holds. */
export type MushafPageSpan = { first: MushafVerse; last: MushafVerse };

const PAGES = data.pages as [number, number, number, number][];
const CUZ = data.cuz as [number, number][];
const SECDE = data.secde as [number, number, number, number, number][];

/**
 * A sajdah verse on its page, and where the edition's green highlight of it begins — the top
 * right of its first line, as fractions of the page (`x` from the left, `y` from the top).
 */
export type MushafSecde = { sura: number; ayah: number; x: number; y: number };

/** Every page is this shape — 1024 × 1680 — so a page can be laid out before it arrives. */
export const MUSHAF_PAGE_ASPECT = 1024 / 1680;

export const MUSHAF_PAGE_COUNT = PAGES.length;

/** The pages a cüz spans, in reading order; empty for a cüz that does not exist. */
export const mushafCuzPages = (cuzNumber: number): number[] => {
	const range = CUZ[cuzNumber - 1];

	if (!range) {
		return [];
	}

	const [first, last] = range;

	return Array.from({ length: last - first + 1 }, (_, index) => first + index);
};

/** The ayahs a page holds, first and last; `undefined` outside 0–604. */
export const mushafPageSpan = (page: number): MushafPageSpan | undefined => {
	const entry = PAGES[page];

	return entry
		? { first: { ayah: entry[1], chapter: entry[0] }, last: { ayah: entry[3], chapter: entry[2] } }
		: undefined;
};

/** The sajdah verse a page holds, if any — fourteen pages in the whole mushaf. */
export const mushafPageSecde = (page: number): MushafSecde | undefined => {
	const entry = SECDE.find(([secdePage]) => secdePage === page);

	return entry ? { ayah: entry[2], sura: entry[1], x: entry[3], y: entry[4] } : undefined;
};

/** The file a page is served as, relative to the API's origin. */
export const mushafPagePath = (page: number) => `/mushaf/page-${String(page).padStart(3, '0')}.png`;

/**
 * The Hatim duası in this edition's own hand: the four pages its app sets after the mushaf, in
 * order, served beside the pages (`scripts/import-hayrat-mushaf.ts`).
 */
export const MUSHAF_DUA_PATHS = [1, 2, 3, 4].map(index => `/mushaf/dua-${index}.png`);
