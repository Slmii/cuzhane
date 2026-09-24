import { CUZ_COUNT } from '@/lib/utils/units';
import cuz01 from './quran/cuz-01.json';
import cuz02 from './quran/cuz-02.json';
import cuz03 from './quran/cuz-03.json';
import cuz04 from './quran/cuz-04.json';
import cuz05 from './quran/cuz-05.json';
import cuz06 from './quran/cuz-06.json';
import cuz07 from './quran/cuz-07.json';
import cuz08 from './quran/cuz-08.json';
import cuz09 from './quran/cuz-09.json';
import cuz10 from './quran/cuz-10.json';
import cuz11 from './quran/cuz-11.json';
import cuz12 from './quran/cuz-12.json';
import cuz13 from './quran/cuz-13.json';
import cuz14 from './quran/cuz-14.json';
import cuz15 from './quran/cuz-15.json';
import cuz16 from './quran/cuz-16.json';
import cuz17 from './quran/cuz-17.json';
import cuz18 from './quran/cuz-18.json';
import cuz19 from './quran/cuz-19.json';
import cuz20 from './quran/cuz-20.json';
import cuz21 from './quran/cuz-21.json';
import cuz22 from './quran/cuz-22.json';
import cuz23 from './quran/cuz-23.json';
import cuz24 from './quran/cuz-24.json';
import cuz25 from './quran/cuz-25.json';
import cuz26 from './quran/cuz-26.json';
import cuz27 from './quran/cuz-27.json';
import cuz28 from './quran/cuz-28.json';
import cuz29 from './quran/cuz-29.json';
import cuz30 from './quran/cuz-30.json';

/** Which verses a page holds — the index; the words themselves live on `lines`. */
export type QuranVerse = { key: string; chapter: number; ayah: number };

/**
 * One word, untouched: `t` is Unicode's Uthmani (`textUthmani`), which every offered face draws.
 * `s` is set on the first word of a sura, where the reader sets the sura's name.
 */
export type QuranWordItem = { t: string; s?: number };
/** The end of a verse — where the reader draws its ayah mark. */
export type QuranVerseEnd = { e: number };
export type QuranWord = QuranWordItem | QuranVerseEnd;

/**
 * One of the mushaf's fifteen lines. `partial` when a cüz boundary cut it, so it holds only
 * this cüz's share of a printed line and must not be spread to the full width.
 */
export type QuranLine = { n: number; w: QuranWord[]; partial?: boolean };

/** One page of the Madinah mushaf, cut to the cüz it belongs to, as its printed lines. */
export type QuranPage = { page: number; verses: QuranVerse[]; lines: QuranLine[] };

export const isVerseEnd = (word: QuranWord): word is QuranVerseEnd => 'e' in word;

type QuranCuzFile = { cuz: number; pages: QuranPage[] };

/**
 * The Kuran, one file per cüz, from `apps/server/scripts/fetch-quran-text.ts` — the King
 * Fahd Complex Madinah mushaf text in its Uthmani orthography, exactly as the Quran
 * Foundation API serves it. **Do not generate, normalise or approximate any of it.**
 *
 * **Bundled, not fetched**, for the reasons the cüz metadata is and the Cevşen text before
 * it: the reader has to work offline, the text never changes, and the API credentials must
 * never reach a mobile bundle. Thirty files rather than one so a re-fetch diffs by cüz —
 * Metro bundles all thirty either way, about 2.4 MB.
 *
 * Page- and line-shaped because Q5 reads a cüz the way the printed mushaf sets it: its 604
 * pages — the numbering `cuz.data.json` took its `pageCount` from — each of fifteen lines,
 * which `quran.test.ts` holds the data to.
 */
const FILES: readonly QuranCuzFile[] = [
	cuz01,
	cuz02,
	cuz03,
	cuz04,
	cuz05,
	cuz06,
	cuz07,
	cuz08,
	cuz09,
	cuz10,
	cuz11,
	cuz12,
	cuz13,
	cuz14,
	cuz15,
	cuz16,
	cuz17,
	cuz18,
	cuz19,
	cuz20,
	cuz21,
	cuz22,
	cuz23,
	cuz24,
	cuz25,
	cuz26,
	cuz27,
	cuz28,
	cuz29,
	cuz30
];

/**
 * The pages of a cüz, 1–30, in reading order.
 *
 * Returns `[]` above thirty rather than clamping, as `cuzByNumber` does: a caller asking for
 * cüz 31 has a bug, and the thirtieth's pages would hide it behind a plausible answer.
 */
export const cuzPages = (cuzNumber: number): QuranPage[] => FILES[cuzNumber - 1]?.pages ?? [];

/**
 * The rub el hizb sign, `۞`, which the text carries on the first word of a hizb ("۞ فَمَا").
 * The mushaf prints it in the margin — an ornament of the page, not a letter of the text — so
 * the bundle keeps it and the display drops it.
 */
const RUB_EL_HIZB = /۞\s*/g;

/** Written as an escape: pasted literally, it is indistinguishable from a space and gets "fixed". */
const NO_BREAK_SPACE = '\u00A0';

/**
 * A word as the reader draws it.
 *
 * **The space before a pause mark becomes a no-break space.** Unicode's Uthmani writes a waqf
 * sign after a space ("مِنْهُمْ ۖ" — 4,381 words). A mark on a breakable space could be wrapped
 * away from its word onto the next line alone; on a no-break space — Unicode's own base for a
 * standalone mark — it cannot, and it still sits just after the word it belongs to.
 */
export const wordText = (word: QuranWordItem): string => word.t.replace(RUB_EL_HIZB, '').replace(/ /g, NO_BREAK_SPACE);

/**
 * Each word's verse on a page, line by line — `"16:50"` for every word of it, and for the mark
 * that closes it. A page's `verses` are in reading order and its verse ends match them one for
 * one (held on every page by `quran.test.ts`), so the n-th verse is the one after n ends.
 */
export const pageWordVerses = (page: QuranPage): string[][] => {
	let index = 0;

	return page.lines.map(line =>
		line.w.map(word => {
			const key = page.verses[index]?.key ?? '';

			if (isVerseEnd(word)) {
				index += 1;
			}

			return key;
		})
	);
};

/** The sign of prostration. The edition sets it on the last word of each sajdah verse. */
export const SAJDAH_SIGN = '۩';

/**
 * The sajdah verses, `"chapter:ayah"` — **read from the text**, as the verses carrying `۩`: the
 * edition marks them itself, so no list is kept beside it. Fifteen in this Madinah text, which
 * counts Hac 77 and sets Nahl's at 50; the Hüsrev pages follow their own edition's fourteen.
 */
export const SAJDAH_VERSE_KEYS: ReadonlySet<string> = (() => {
	const keys = new Set<string>();

	for (const file of FILES) {
		for (const page of file.pages) {
			const verses = pageWordVerses(page);

			page.lines.forEach((line, lineIndex) => {
				line.w.forEach((word, wordIndex) => {
					const key = verses[lineIndex]?.[wordIndex];

					if (key && !isVerseEnd(word) && word.t.includes(SAJDAH_SIGN)) {
						keys.add(key);
					}
				});
			});
		}
	}

	return keys;
})();

/**
 * A verse's words as the reader draws them, in order and joined by spaces — the Arabic the meal
 * sheet sets above the meal; empty for a key the text does not hold. **One page is enough**:
 * every page of this edition ends on a verse end, so no verse runs onto the next — which
 * `quran.test.ts` holds, and this would need revisiting if a re-fetch ever broke it.
 */
export const verseText = (verseKey: string): string => {
	for (const file of FILES) {
		const page = file.pages.find(candidate => candidate.verses.some(verse => verse.key === verseKey));

		if (page) {
			const verses = pageWordVerses(page);

			return page.lines
				.flatMap((line, lineIndex) =>
					line.w.flatMap((word, wordIndex) =>
						!isVerseEnd(word) && verses[lineIndex]?.[wordIndex] === verseKey ? [wordText(word)] : []
					)
				)
				.join(' ');
		}
	}

	return '';
};

/** True when every one of the thirty is present and in its place — see `quran.test.ts`. */
export const isQuranTextComplete = (): boolean =>
	FILES.length === CUZ_COUNT && FILES.every((file, index) => file.cuz === index + 1 && file.pages.length > 0);
