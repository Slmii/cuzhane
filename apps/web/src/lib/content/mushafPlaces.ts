import { suraNameFor } from '@/lib/content/cuz';
import { MUSHAF_PAGE_COUNT, mushafCuzPages, mushafPageSpan, type MushafVerse } from '@/lib/content/mushaf';
import { cuzPages } from '@/lib/content/quran';
import { suraInfo } from '@/lib/content/sura';
import type { AppLanguage } from '@/lib/i18n/strings';
import type { CuzPagination } from '@/lib/utils/cuzPagesRead';
import { CUZ_COUNT } from '@/lib/utils/units';

/*
 * Where things are in the mushaf — what Q5n's "Git" sheet needs to send a reader to a sura, an
 * ayah, a cüz or a page, in **either pagination**: the typeset Madinah pages (604, numbered as
 * printed) or Hüsrev's own edition (its pages counted from one).
 *
 * **A place is a cüz and a page within it**, because that is how both readers hold their
 * position. A page the Madinah text shares between two cüz belongs to the first of them — the
 * one it closes — which is where the page number was reached from.
 *
 * **Every answer is a lookup, never a walk.** The sheet asks for 114 suras' start pages as it
 * opens and for a page's place on every frame of a slider drag; the tables below are built once,
 * on first use, and each question after that is an index or a binary search.
 */

export type MushafPlace = {
	cuzNumber: number;
	/** Zero-based, within the cüz. */
	pageIndex: number;
	/** The number a reader sees: the printed Madinah page, or Hüsrev's own count from one. */
	pageNumber: number;
};

const SURA_COUNT = 114;

/** An ayah as one comparable number — 34:10 is 34010; no sura has a thousand ayahs. */
const verseOrder = (verse: MushafVerse) => verse.chapter * 1000 + verse.ayah;

const compareVerses = (a: MushafVerse, b: MushafVerse) => verseOrder(a) - verseOrder(b);

/** Built once: every verse and page of the typeset text, first occurrence kept. */
const typesetIndex = (() => {
	let index: { byVerse: Map<number, MushafPlace>; byPage: Map<number, MushafPlace> } | null = null;

	return () => {
		if (index) {
			return index;
		}

		const byVerse = new Map<number, MushafPlace>();
		const byPage = new Map<number, MushafPlace>();

		for (let cuzNumber = 1; cuzNumber <= CUZ_COUNT; cuzNumber++) {
			cuzPages(cuzNumber).forEach((page, pageIndex) => {
				const place = { cuzNumber, pageIndex, pageNumber: page.page };

				if (!byPage.has(page.page)) {
					byPage.set(page.page, place);
				}

				for (const verse of page.verses) {
					const key = verseOrder(verse);

					if (!byVerse.has(key)) {
						byVerse.set(key, place);
					}
				}
			});
		}

		index = { byPage, byVerse };

		return index;
	};
})();

/** Built once: Hüsrev's cüz for each page, and each page's first ayah, for a binary search. */
const husrevIndex = (() => {
	let index: { cuzOfPage: number[]; firstPageOfCuz: number[]; firstVerseOrder: number[] } | null = null;

	return () => {
		if (index) {
			return index;
		}

		const cuzOfPage: number[] = [];
		const firstPageOfCuz: number[] = [];

		for (let cuzNumber = 1; cuzNumber <= CUZ_COUNT; cuzNumber++) {
			const pages = mushafCuzPages(cuzNumber);

			firstPageOfCuz[cuzNumber] = pages[0] ?? 0;
			pages.forEach(page => {
				cuzOfPage[page] = cuzNumber;
			});
		}

		const firstVerseOrder = Array.from({ length: MUSHAF_PAGE_COUNT }, (_, page) => {
			const span = mushafPageSpan(page);

			return span ? verseOrder(span.first) : Number.MAX_SAFE_INTEGER;
		});

		index = { cuzOfPage, firstPageOfCuz, firstVerseOrder };

		return index;
	};
})();

const husrevPlace = (pageIndexInMushaf: number): MushafPlace | undefined => {
	const { cuzOfPage, firstPageOfCuz } = husrevIndex();
	const cuzNumber = cuzOfPage[pageIndexInMushaf];
	const first = cuzNumber === undefined ? undefined : firstPageOfCuz[cuzNumber];

	return cuzNumber === undefined || first === undefined
		? undefined
		: { cuzNumber, pageIndex: pageIndexInMushaf - first, pageNumber: pageIndexInMushaf + 1 };
};

/** How many pages the pagination has, as numbered. */
export const pageTotalFor = (pagination: CuzPagination): number =>
	pagination === 'husrev' ? MUSHAF_PAGE_COUNT : cuzPages(CUZ_COUNT).at(-1)?.page ?? 0;

/** The place a page number opens on; `undefined` outside the pagination. */
export const placeOfPage = (pageNumber: number, pagination: CuzPagination): MushafPlace | undefined =>
	pagination === 'husrev' ? husrevPlace(pageNumber - 1) : typesetIndex().byPage.get(pageNumber);

/** The page an ayah is on; `undefined` for an ayah that does not exist. */
export const placeOfVerse = (verse: MushafVerse, pagination: CuzPagination): MushafPlace | undefined => {
	const count = suraInfo(verse.chapter)?.versesCount ?? 0;

	if (verse.ayah < 1 || verse.ayah > count) {
		return undefined;
	}

	if (pagination === 'text') {
		return typesetIndex().byVerse.get(verseOrder(verse));
	}

	// The last page whose first ayah is at or before this one.
	const { firstVerseOrder } = husrevIndex();
	const target = verseOrder(verse);
	let low = 0;
	let high = firstVerseOrder.length - 1;

	while (low < high) {
		const middle = Math.ceil((low + high) / 2);

		if ((firstVerseOrder[middle] ?? Number.MAX_SAFE_INTEGER) <= target) {
			low = middle;
		} else {
			high = middle - 1;
		}
	}

	return husrevPlace(low);
};

/** The first ayah on a reader's page — the "Şu an: 34:10" of the sheet's heading. */
export const firstVerseAt = (
	cuzNumber: number,
	pageIndex: number,
	pagination: CuzPagination
): MushafVerse | undefined => {
	if (pagination === 'text') {
		return cuzPages(cuzNumber)[pageIndex]?.verses[0];
	}

	const first = husrevIndex().firstPageOfCuz[cuzNumber];

	return first === undefined ? undefined : mushafPageSpan(first + pageIndex)?.first;
};

/** The page number a reader's place shows. */
export const pageNumberAt = (cuzNumber: number, pageIndex: number, pagination: CuzPagination): number | undefined => {
	if (pagination === 'text') {
		return cuzPages(cuzNumber)[pageIndex]?.page;
	}

	const pages = mushafCuzPages(cuzNumber);

	return pageIndex >= 0 && pageIndex < pages.length ? (pages[pageIndex] ?? 0) + 1 : undefined;
};

type VerseRange = { first: MushafVerse; last: MushafVerse };

/** Every cüz's first and last ayah, per pagination — the two divisions differ at a few boundaries. */
const cuzRanges = (() => {
	const cache = new Map<CuzPagination, (VerseRange | undefined)[]>();

	return (pagination: CuzPagination) => {
		const cached = cache.get(pagination);

		if (cached) {
			return cached;
		}

		const ranges = Array.from({ length: CUZ_COUNT + 1 }, (_, cuzNumber): VerseRange | undefined => {
			if (cuzNumber === 0) {
				return undefined;
			}

			if (pagination === 'text') {
				const pages = cuzPages(cuzNumber);
				const first = pages[0]?.verses[0];
				const last = pages.at(-1)?.verses.at(-1);

				return first && last ? { first, last } : undefined;
			}

			const pages = mushafCuzPages(cuzNumber);
			const first = pages[0] === undefined ? undefined : mushafPageSpan(pages[0])?.first;
			const lastPage = pages.at(-1);
			const last = lastPage === undefined ? undefined : mushafPageSpan(lastPage)?.last;

			return first && last ? { first, last } : undefined;
		});

		cache.set(pagination, ranges);

		return ranges;
	};
})();

export const cuzVerseRange = (cuzNumber: number, pagination: CuzPagination): VerseRange | undefined =>
	cuzRanges(pagination)[cuzNumber];

/** A sura as the sheet's list shows it — everything a row needs, worked out once. */
export type SuraEntry = {
	chapter: number;
	name: string;
	/** `name` folded for matching — see `foldName`. */
	folded: string;
	ayahCount: number;
	/** The cüz its first and last ayah are in, by the pagination's own division. */
	cuzFirst: number;
	cuzLast: number;
	/** The page its first ayah is on, as numbered in the pagination. */
	startPage: number;
};

/** The 114, per language and pagination — built on first use, then kept. */
export const suraEntries = (() => {
	const cache = new Map<string, SuraEntry[]>();

	return (language: AppLanguage, pagination: CuzPagination): SuraEntry[] => {
		const key = `${language}|${pagination}`;
		const cached = cache.get(key);

		if (cached) {
			return cached;
		}

		const entries = Array.from({ length: SURA_COUNT }, (_, index): SuraEntry => {
			const chapter = index + 1;
			const ayahCount = suraInfo(chapter)?.versesCount ?? 0;
			const start = placeOfVerse({ ayah: 1, chapter }, pagination);
			const end = placeOfVerse({ ayah: ayahCount, chapter }, pagination);
			const name = suraNameFor(chapter, language);

			return {
				ayahCount,
				chapter,
				cuzFirst: start?.cuzNumber ?? 0,
				cuzLast: end?.cuzNumber ?? start?.cuzNumber ?? 0,
				folded: foldName(name),
				name,
				startPage: start?.pageNumber ?? 0
			};
		});

		cache.set(key, entries);

		return entries;
	};
})();

/** One row of Q5j's "22. Cüz · Bölümler": where the cüz opens, then every sura that begins in it. */
export type CuzSection = { verse: MushafVerse; isCuzStart: boolean; place: MushafPlace };

export const cuzSections = (cuzNumber: number, pagination: CuzPagination): CuzSection[] => {
	const range = cuzVerseRange(cuzNumber, pagination);
	const start = range === undefined ? undefined : placeOfVerse(range.first, pagination);

	if (!range || !start) {
		return [];
	}

	// The cüz's own start is on its first page, even where that page opens in the cüz before.
	const opening: CuzSection = { isCuzStart: true, place: { ...start, cuzNumber, pageIndex: 0 }, verse: range.first };
	// Every sura, not the metadata's list for this cüz: Hüsrev's division moves a few boundaries.
	const suraStarts = Array.from({ length: SURA_COUNT }, (_, index) => ({ ayah: 1, chapter: index + 1 }))
		.filter(verse => compareVerses(range.first, verse) < 0 && compareVerses(verse, range.last) <= 0)
		.flatMap(verse => {
			const place = placeOfVerse(verse, pagination);

			return place ? [{ isCuzStart: false, place, verse }] : [];
		});

	return [opening, ...suraStarts];
};

/** What the search box was given: an ayah ("34:10"), a page number, or words to match a sura by. */
export type GoQuery =
	| { kind: 'verse'; verse: MushafVerse }
	| { kind: 'page'; pageNumber: number }
	| { kind: 'name'; text: string }
	| { kind: 'none' };

export const parseGoQuery = (raw: string): GoQuery => {
	const text = raw.trim();

	if (text === '') {
		return { kind: 'none' };
	}

	const verseMatch = /^(\d{1,3})\s*[:.]\s*(\d{1,3})$/.exec(text);

	if (verseMatch) {
		return { kind: 'verse', verse: { ayah: Number(verseMatch[2]), chapter: Number(verseMatch[1]) } };
	}

	if (/^\d{1,3}$/.test(text)) {
		return { kind: 'page', pageNumber: Number(text) };
	}

	return { kind: 'name', text };
};

/**
 * A name folded for matching: lower case in Turkish rules, the circumflexes and apostrophes of
 * the transliteration dropped — "yasin" finds "Yâsîn", "sebe" finds "Sebe’".
 */
export const foldName = (value: string): string =>
	value
		.toLocaleLowerCase('tr')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/ı/g, 'i')
		.replace(/[’'‘`ʿʾ-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

/** The suras whose name, in the language on screen, contains the text — in mushaf order. */
export const matchSuras = (text: string, language: AppLanguage, pagination: CuzPagination): SuraEntry[] => {
	const needle = foldName(text);

	return suraEntries(language, pagination).filter(entry => entry.folded.includes(needle));
};

/** One Kur'an result on the search page: a sura, an ayah or a page, and where it opens. */
export type QuranHit =
	| { kind: 'sura'; entry: SuraEntry; place: MushafPlace }
	| { kind: 'ayah'; verse: MushafVerse; place: MushafPlace }
	| { kind: 'page'; first: MushafVerse; place: MushafPlace };

/**
 * The search page's Kur'an section — by reference only, as the Git sheet reads a query: a sura by
 * name, an ayah as "34:10", a page by number. The text itself is not searched.
 */
export const searchQuran = (query: string, language: AppLanguage, pagination: CuzPagination): QuranHit[] => {
	const parsed = parseGoQuery(query);

	if (parsed.kind === 'name') {
		return matchSuras(parsed.text, language, pagination).flatMap(entry => {
			// By its first ayah, not its page: a page two cüz share opens in the first of them, which
			// for Ahkâf (typeset p. 502) is the part it is not on.
			const place = placeOfVerse({ ayah: 1, chapter: entry.chapter }, pagination);

			return place ? [{ entry, kind: 'sura' as const, place }] : [];
		});
	}

	if (parsed.kind === 'verse') {
		const place = placeOfVerse(parsed.verse, pagination);

		return place ? [{ kind: 'ayah', place, verse: parsed.verse }] : [];
	}

	if (parsed.kind === 'page') {
		const place = placeOfPage(parsed.pageNumber, pagination);
		const first = place && firstVerseAt(place.cuzNumber, place.pageIndex, pagination);

		return place && first ? [{ first, kind: 'page', place }] : [];
	}

	return [];
};
