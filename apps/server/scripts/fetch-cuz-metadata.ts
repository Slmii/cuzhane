// Loads `apps/server/.env`, where the two credentials live — the same thing
// `src/config/env.ts` does for the server itself. Must come before they are read.
import 'dotenv/config';
import { Language, type Juz, type VerseKey } from '@quranjs/api';
import { createServerClient } from '@quranjs/api/server';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Fetches the thirty cüz and writes them out as a committed JSON file.
 *
 * **Run once, by hand, and commit the result.** This is not a runtime dependency: the cüz
 * boundaries have not changed in a very long time and will not change between releases, so
 * asking an API for them on every group screen would be a network round trip to learn
 * something fixed — and it would put the credentials somewhere they must never be. The
 * Quran Foundation docs are explicit that `client_secret` belongs on a server and never in
 * browser or mobile code, and `EXPO_PUBLIC_*` is inlined into the bundle, so the client
 * could not hold these keys even if we wanted it to.
 *
 * The output lands in `apps/web`, beside `cevsen.data.json`, because the app is what renders
 * it. The server never reads this file; a cüz *number* is all it stores.
 *
 *     QURAN_CLIENT_ID=… QURAN_CLIENT_SECRET=… pnpm --filter @cuzhane/server cuz:fetch
 *
 * What each entry carries, and why:
 *
 * - `suraRange` — the design's "Ahzâb 31 – Yâsîn 27", built from `verseMapping`, which is
 *   the API's own record of which ayahs of which suras fall inside a juz. Derived here
 *   rather than in the app: it is the same answer every time.
 * - `pageCount` — "20 sayfa", measured between the juz's first and last verse. The page
 *   numbers are the Madani mushaf's, which is what a reader holding a physical copy is
 *   counting in.
 * - `suras` — the per-sura breakdown Q5 lists under "Cüzde neler var": which ayahs of which
 *   sura fall inside this cüz.
 * - `verseCount` — not shown anywhere yet, and kept because it is free and is the natural
 *   thing to want the moment a progress figure needs a denominator finer than a whole cüz.
 */

const CUZ_COUNT = 30;
const OUTPUT_PATH = resolve(import.meta.dirname, '../../web/src/lib/content/cuz.data.json');
/**
 * The 114 suras themselves — the Arabic name, how many ayahs, whether the basmala precedes it.
 * What the reader's sura heading frames: "سورة الملك", "آياتها ٣٠", "ترتيبها ٦٧".
 */
const SURA_OUTPUT_PATH = resolve(import.meta.dirname, '../../web/src/lib/content/sura.data.json');
const SURA_COUNT = 114;
const VERSE_COUNT = 6236;

/**
 * The app's three interface languages, in the API's own enum, keyed by our short code so the
 * file it writes is indexed the way `strings.ts` is.
 *
 * **`usesTranslatedName` is the interesting part.** The API offers two names per sura:
 * `translatedName`, the meaning, and `nameSimple`, the Latin transliteration. Turkish names
 * suras by transliteration — "Ahzâb", "Yâsîn" — and that is what its `translatedName`
 * returns, so for Turkish the two coincide and the translated one is right. English and
 * Dutch return the *meaning*: "The Combined Forces", "De Bondgenoten". A range written that
 * way reads as a description rather than a reference — "The Cow 141" is not how anyone
 * cites a sura in English either, where the convention is the transliteration. So those two
 * take `nameSimple`.
 */
const LANGUAGES = {
	en: { language: Language.ENGLISH, usesTranslatedName: false },
	nl: { language: Language.DUTCH, usesTranslatedName: false },
	tr: { language: Language.TURKISH, usesTranslatedName: true }
} as const;

type AppLanguage = keyof typeof LANGUAGES;

/** One sura's slice of a cüz — Q5's "Cüzde neler var" list. */
type CuzSura = {
	chapterId: number;
	/** The sura's name per interface language, as the range above spells it. */
	name: Record<AppLanguage, string>;
	firstAyah: number;
	lastAyah: number;
};

type CuzEntry = {
	number: number;
	/** `{ tr: 'Ahzâb 31 – Yâsîn 27', … }` — one line per interface language. */
	suraRange: Record<AppLanguage, string>;
	/**
	 * Every sura the cüz touches, in order, with the ayahs of each that fall inside it.
	 *
	 * The overall range above is the *headline*; this is the breakdown Q5 lists under "Cüzde
	 * neler var". Both come from the same `verseMapping`, so they cannot disagree — deriving
	 * one from the other in the app would be a second place for the boundaries to live.
	 */
	suras: CuzSura[];
	firstVerseKey: string;
	lastVerseKey: string;
	pageCount: number;
	verseCount: number;
};

const requireEnv = (name: string): string => {
	const value = process.env[name];

	if (!value) {
		throw new Error(
			`${name} is not set. Both QURAN_CLIENT_ID and QURAN_CLIENT_SECRET are needed; they are the Quran Foundation credentials and must never be committed.`
		);
	}

	return value;
};

const main = async () => {
	const client = createServerClient({
		clientId: requireEnv('QURAN_CLIENT_ID'),
		clientSecret: requireEnv('QURAN_CLIENT_SECRET')
	});

	/*
	 * **The API answers with sixty, not thirty.** Every juz comes back twice under two ids
	 * (1–30 and 61–90) — two mushaf datasets carrying the same boundaries. They are
	 * de-duplicated by `juzNumber` here, and the twins are *compared* rather than assumed
	 * identical: if the two datasets ever disagree about where a juz begins, this file would
	 * silently take whichever arrived first, and that is exactly the kind of thing worth
	 * being stopped by.
	 */
	const byNumber = new Map<number, Juz>();

	for (const juz of await client.juzs.findAll()) {
		const seen = byNumber.get(juz.juzNumber);

		if (!seen) {
			byNumber.set(juz.juzNumber, juz);
			continue;
		}

		if (JSON.stringify(seen.verseMapping) !== JSON.stringify(juz.verseMapping)) {
			throw new Error(
				`Juz ${juz.juzNumber} came back twice with different boundaries: ${JSON.stringify(
					seen.verseMapping
				)} vs ${JSON.stringify(juz.verseMapping)}`
			);
		}
	}

	const juzs = [...byNumber.values()];

	if (juzs.length !== CUZ_COUNT) {
		// A different count means the API's shape has moved, not that the Qur'an has. Better
		// to stop than to write a file that is quietly short.
		throw new Error(`Expected ${CUZ_COUNT} juz, the API returned ${juzs.length} distinct`);
	}

	/** Sura names per language, so a range can be written in whichever one is on screen. */
	const namesByLanguage = new Map<string, Map<number, string>>();

	for (const code of Object.keys(LANGUAGES) as AppLanguage[]) {
		const { language, usesTranslatedName } = LANGUAGES[code];
		const chapters = await client.chapters.findAll({ language });

		namesByLanguage.set(
			code,
			new Map(
				chapters.map(chapter => [
					chapter.id,
					// The fallback keeps a missing translation from writing "undefined 31".
					(usesTranslatedName ? chapter.translatedName?.name : chapter.nameSimple) ?? chapter.nameSimple
				])
			)
		);
	}

	/*
	 * The suras as the API describes them, language-free: its Arabic name, its length, whether
	 * the basmala precedes it, and where it was revealed (the sura heading's "Mekkî" / "Medenî").
	 * Checked before anything is written — every sura present once and in order, each placed in
	 * Mecca or Medina, and the lengths summing to the mushaf's 6236.
	 */
	const suras = (await client.chapters.findAll())
		.map(chapter => ({
			bismillahPre: chapter.bismillahPre,
			nameArabic: chapter.nameArabic,
			number: chapter.id,
			revelationPlace: chapter.revelationPlace,
			versesCount: chapter.versesCount
		}))
		.sort((a, b) => a.number - b.number);

	if (
		suras.length !== SURA_COUNT ||
		suras.some(
			(sura, index) =>
				sura.number !== index + 1 ||
				!sura.nameArabic ||
				(sura.revelationPlace !== 'makkah' && sura.revelationPlace !== 'madinah')
		)
	) {
		throw new Error(`Expected suras 1–${SURA_COUNT}, each with an Arabic name and a place of revelation`);
	}

	const suraVerses = suras.reduce((total, sura) => total + sura.versesCount, 0);

	if (suraVerses !== VERSE_COUNT) {
		throw new Error(`The suras hold ${suraVerses} ayahs, expected ${VERSE_COUNT}`);
	}

	const entries: CuzEntry[] = [];

	for (const juz of juzs.sort((a, b) => a.juzNumber - b.juzNumber)) {
		// `verseMapping` is `{ chapterId: 'firstAyah-lastAyah' }`, in order.
		const mapping = Object.entries(juz.verseMapping).map(([chapterId, range]) => ({
			chapterId: Number(chapterId),
			range: String(range)
		}));

		const first = mapping.at(0);
		const last = mapping.at(-1);

		if (!first || !last) {
			throw new Error(`Juz ${juz.juzNumber} has an empty verse mapping`);
		}

		const firstAyah = first.range.split('-').at(0) ?? '1';
		const lastAyah = last.range.split('-').at(-1) ?? '1';

		/*
		 * **The page span comes from the two boundary verses, not from every verse in the juz.**
		 * `findByJuz` is paginated — it answers with the first page of verses and nothing says
		 * so, which had this reporting "2 sayfa" for a cüz that spans twenty. Pages run in
		 * order, so the first and last verse are all that is needed, and it is two requests
		 * instead of dozens.
		 */
		const [firstVerse, lastVerse] = await Promise.all([
			client.verses.findByKey(`${first.chapterId}:${firstAyah}` as VerseKey),
			client.verses.findByKey(`${last.chapterId}:${lastAyah}` as VerseKey)
		]);

		const pageCount = lastVerse.pageNumber - firstVerse.pageNumber + 1;

		if (pageCount < 1) {
			throw new Error(
				`Juz ${juz.juzNumber} spans ${pageCount} pages (${firstVerse.pageNumber} → ${lastVerse.pageNumber})`
			);
		}

		const suraRange = Object.fromEntries(
			(Object.keys(LANGUAGES) as AppLanguage[]).map(code => {
				const names = namesByLanguage.get(code);
				const firstName = names?.get(first.chapterId) ?? String(first.chapterId);
				const lastName = names?.get(last.chapterId) ?? String(last.chapterId);

				return [
					code,
					// A juz that begins and ends inside one sura says it once: "Bakara 1 – 141",
					// not "Bakara 1 – Bakara 141".
					first.chapterId === last.chapterId
						? `${firstName} ${firstAyah} – ${lastAyah}`
						: `${firstName} ${firstAyah} – ${lastName} ${lastAyah}`
				];
			})
		) as CuzEntry['suraRange'];

		const suras: CuzSura[] = mapping.map(entry => {
			const [from, to] = entry.range.split('-');

			return {
				chapterId: entry.chapterId,
				firstAyah: Number(from ?? 1),
				lastAyah: Number(to ?? from ?? 1),
				name: Object.fromEntries(
					(Object.keys(LANGUAGES) as AppLanguage[]).map(code => [
						code,
						namesByLanguage.get(code)?.get(entry.chapterId) ?? String(entry.chapterId)
					])
				) as CuzSura['name']
			};
		});

		entries.push({
			firstVerseKey: `${first.chapterId}:${firstAyah}`,
			lastVerseKey: `${last.chapterId}:${lastAyah}`,
			number: juz.juzNumber,
			pageCount,
			suraRange,
			suras,
			verseCount: juz.versesCount
		});

		console.log(`Cüz ${juz.juzNumber}: ${suraRange.tr} · ${entries.at(-1)?.pageCount} sayfa`);
	}

	await writeFile(
		OUTPUT_PATH,
		`${JSON.stringify(
			{
				cuz: entries,
				meta: {
					fetchedAt: new Date().toISOString().slice(0, 10),
					note: 'Generated by apps/server/scripts/fetch-cuz-metadata.ts. Do not edit by hand; re-run the script.',
					source: 'Quran Foundation API via @quranjs/api'
				}
			},
			null,
			'\t'
		)}\n`
	);

	console.log(`\nWrote ${entries.length} cüz to ${OUTPUT_PATH}`);

	await writeFile(
		SURA_OUTPUT_PATH,
		`${JSON.stringify(
			{
				meta: {
					fetchedAt: new Date().toISOString().slice(0, 10),
					note: 'Generated by apps/server/scripts/fetch-cuz-metadata.ts. Do not edit by hand; re-run the script.',
					source: 'Quran Foundation API via @quranjs/api'
				},
				suras
			},
			null,
			'\t'
		)}\n`
	);

	console.log(`Wrote ${suras.length} suras to ${SURA_OUTPUT_PATH}`);
};

await main();
