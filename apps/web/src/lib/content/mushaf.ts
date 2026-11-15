import data from './mushaf.data.json';

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

/** The file a page is served as, relative to the API's origin — behind the auth gate. */
export const mushafPagePath = (page: number) => `/api/mushaf/page-${String(page).padStart(3, '0')}.png`;

/**
 * The Hatim duası in this edition's own hand: the four pages its app sets after the mushaf, in
 * order, served beside the pages.
 */
export const MUSHAF_DUA_PATHS = [1, 2, 3, 4].map(index => `/api/mushaf/dua-${index}.png`);
