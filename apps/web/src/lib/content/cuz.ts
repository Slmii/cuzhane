import type { AppLanguage } from '@/lib/i18n/strings';
import { CUZ_COUNT } from '@/lib/utils/units';
import cuzData from './cuz.data.json';

/** One sura's slice of a cüz — a row of Q5's "Cüzde neler var". */
export type CuzSura = {
	chapterId: number;
	name: Record<AppLanguage, string>;
	firstAyah: number;
	lastAyah: number;
};

export type CuzEntry = {
	number: number;
	/** "Ahzâb 31 – Yâsîn 27", per interface language. */
	suraRange: Record<AppLanguage, string>;
	/** Every sura the cüz touches, in order, with the ayahs of each that fall inside it. */
	suras: CuzSura[];
	firstVerseKey: string;
	lastVerseKey: string;
	pageCount: number;
	verseCount: number;
};

/**
 * The thirty cüz, from `cuz.data.json` — fetched once from the Quran Foundation API by
 * `apps/server/scripts/fetch-cuz-metadata.ts` and committed.
 *
 * **Bundled, not fetched.** The boundaries are fixed, so asking an API for them would be a
 * round trip to learn something unchanging — and the credentials it needs must never reach
 * a mobile bundle, which `EXPO_PUBLIC_*` would guarantee they did. Re-run the script when
 * there is a reason to; nothing here reaches the network.
 */
const entries = cuzData.cuz as CuzEntry[];

/**
 * By number, 1–30.
 *
 * Returns `undefined` above thirty rather than clamping: a caller asking for cüz 31 has a
 * bug, and handing it back the thirtieth would hide it behind a plausible-looking answer.
 */
export const cuzByNumber = (number: number): CuzEntry | undefined => entries[number - 1];

/** Every cüz, in order. */
export const allCuz = (): CuzEntry[] => entries;

/** The design's "Ahzâb 31 – Yâsîn 27" for a cüz, in the language on screen. */
export const cuzSuraRange = (number: number, language: AppLanguage): string =>
	cuzByNumber(number)?.suraRange[language] ?? '';

/**
 * A sura's name in the language on screen, by number — from whichever cüz lists it, so a sura
 * is found even where a page and a cüz disagree about where one begins (the Hüsrev mushaf's cüz
 * 26 opens in Câsiye, which this file's cüz 26 does not touch). Empty for a number outside 1–114.
 */
export const suraNameFor = (chapter: number, language: AppLanguage): string =>
	entries.flatMap(entry => entry.suras).find(sura => sura.chapterId === chapter)?.name[language] ?? '';

/** True when the bundled file holds what it should — see `cuz.test.ts`. */
export const isCuzDataComplete = (): boolean =>
	entries.length === CUZ_COUNT && entries.every((entry, index) => entry.number === index + 1);
