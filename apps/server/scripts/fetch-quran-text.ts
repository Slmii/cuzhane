/**
 * Fetches the Kuran's text, one file per cüz, into the web app's bundled content.
 *
 *     QURAN_CLIENT_ID=… QURAN_CLIENT_SECRET=… pnpm --filter @cuzhane/server quran:fetch
 *
 * **Bundled, not fetched at runtime**, for the same reasons the cüz metadata is: the text
 * does not change, the reader has to work offline, and the credentials must never reach a
 * mobile bundle. And **never generated, never normalised**: what is written is the King
 * Fahd Complex Madinah mushaf text exactly as the Quran Foundation API serves it.
 *
 * **Line-shaped, because the printed page is.** The mushaf sets fifteen lines a page and every
 * word has a line; the API says which (`lineNumber`). The reader draws each line as a row and
 * spreads its words across the width itself — the way quran.com fills the measure — rather than
 * handing one long paragraph to the text engine to justify. iOS's justification shifts the
 * marks on the last word of a stretched line (أَنَّ lost its shadda-with-fatha in 27:82), and a
 * pause mark that follows a space could wrap onto the next line alone. Lines that come from the
 * mushaf itself have neither problem: nothing is re-broken and nothing is stretched inside a word.
 *
 * **One encoding per word**: `t`, Unicode's Uthmani (`textUthmani`), which every offered face
 * draws. The Complex's own encoding (`textQpcHafs`) was bundled beside it while their HAFS face
 * was offered, and went with it. A verse's end is its own item, `{ e: ayah }`, where the reader
 * draws its mark.
 *
 * A page is fetched whole and then cut to the cüz: a boundary can fall mid-page, and mid-line,
 * so a line keeps only this cüz's words and says so (`partial`) — it is not a full line any
 * more and must not be spread to the edges.
 *
 * Everything is checked before anything is written, and each check stops the run: every verse
 * of every cüz is present with its words and exactly one end, pages and verses match the
 * metadata, lines stay within the mushaf's fifteen, and the thirty together hold 6236 verses.
 */
import 'dotenv/config';
import { createServerClient } from '@quranjs/api/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CUZ_COUNT = 30;
const VERSE_COUNT = 6236;
const LINES_PER_PAGE = 15;
/** The API's page size ceiling. A mushaf page never holds more verses, but the loop checks. */
const PER_PAGE = 50;

const CONTENT_DIR = resolve(import.meta.dirname, '../../web/src/lib/content');
const METADATA_PATH = resolve(CONTENT_DIR, 'cuz.data.json');
const OUTPUT_DIR = resolve(CONTENT_DIR, 'quran');

type CuzMetadata = {
	number: number;
	firstVerseKey: string;
	lastVerseKey: string;
	pageCount: number;
	verseCount: number;
};

/**
 * One item on a line: a word, or the end of a verse. `s` marks the first word of a sura — where
 * the reader sets the sura's name and, for all but two, the basmala.
 */
type QuranWord = { t: string; s?: number } | { e: number };
type QuranLine = { n: number; w: QuranWord[]; partial?: true };
type QuranVerse = { key: string; chapter: number; ayah: number };
type QuranPage = { page: number; verses: QuranVerse[]; lines: QuranLine[] };

type ApiWord = {
	charTypeName: string;
	lineNumber: number;
	position: number;
	textUthmani?: string;
	verseKey: string;
};
type ApiVerse = { verseKey: string; chapterId: number; verseNumber: number; words: ApiWord[] };

const requireEnv = (name: string): string => {
	const value = process.env[name];

	if (!value) {
		throw new Error(
			`${name} is not set. Both QURAN_CLIENT_ID and QURAN_CLIENT_SECRET are needed; they are the Quran Foundation credentials and must never be committed.`
		);
	}

	return value;
};

const parseKey = (key: string): [number, number] => {
	const [chapter, ayah] = key.split(':').map(Number);

	if (!chapter || !ayah) {
		throw new Error(`Malformed verse key "${key}"`);
	}

	return [chapter, ayah];
};

/** Verse order is chapter first, then ayah — the order the mushaf reads in. */
const compareKeys = (a: [number, number], b: [number, number]): number => a[0] - b[0] || a[1] - b[1];

const main = async () => {
	const client = createServerClient({
		clientId: requireEnv('QURAN_CLIENT_ID'),
		clientSecret: requireEnv('QURAN_CLIENT_SECRET')
	});

	const metadata = JSON.parse(await readFile(METADATA_PATH, 'utf8')) as { cuz: CuzMetadata[] };

	if (metadata.cuz.length !== CUZ_COUNT) {
		throw new Error(`cuz.data.json holds ${metadata.cuz.length} cüz, expected ${CUZ_COUNT} — run cuz:fetch first`);
	}

	await mkdir(OUTPUT_DIR, { recursive: true });

	/** A page, fetched once: the page straddling two cüz is asked for by both. */
	const pageCache = new Map<number, ApiVerse[]>();

	const fetchPage = async (page: number): Promise<ApiVerse[]> => {
		const cached = pageCache.get(page);

		if (cached) {
			return cached;
		}

		const verses: ApiVerse[] = [];

		// Paginated defensively: `findByJuz` once came back ten verses at a time and read as
		// "2 sayfa" until it was noticed. A mushaf page fits in one request, but the loop
		// costs nothing and would catch the same thing here.
		for (let apiPage = 1; ; apiPage += 1) {
			const batch = (await client.verses.findByPage(
				String(page) as never,
				{
					fields: { chapterId: true },
					page: apiPage,
					perPage: PER_PAGE,
					wordFields: { textUthmani: true, verseKey: true },
					words: true
				} as never
			)) as unknown as ApiVerse[];

			verses.push(...batch);

			if (batch.length < PER_PAGE) {
				break;
			}
		}

		pageCache.set(page, verses);

		return verses;
	};

	let total = 0;

	for (const cuz of [...metadata.cuz].sort((a, b) => a.number - b.number)) {
		const first = parseKey(cuz.firstVerseKey);
		const last = parseKey(cuz.lastVerseKey);
		const inCuz = (key: [number, number]) => compareKeys(key, first) >= 0 && compareKeys(key, last) <= 0;

		// The page span comes from the two boundary verses, as `cuz:fetch` takes it — never
		// from a paginated juz listing.
		const [firstVerse, lastVerse] = await Promise.all([
			client.verses.findByKey(cuz.firstVerseKey as never),
			client.verses.findByKey(cuz.lastVerseKey as never)
		]);
		const firstPage = (firstVerse as unknown as { pageNumber: number }).pageNumber;
		const lastPage = (lastVerse as unknown as { pageNumber: number }).pageNumber;

		const pages: QuranPage[] = [];

		for (let page = firstPage; page <= lastPage; page += 1) {
			const all = await fetchPage(page);
			const kept = all
				.filter(verse => inCuz([verse.chapterId, verse.verseNumber]))
				.sort((a, b) => compareKeys([a.chapterId, a.verseNumber], [b.chapterId, b.verseNumber]));

			if (kept.length === 0) {
				throw new Error(`Page ${page} holds nothing of cüz ${cuz.number}, yet lies inside its span`);
			}

			// Which lines also carry words of a verse this cüz does not hold — cut lines.
			const foreignLines = new Set(
				all
					.filter(verse => !inCuz([verse.chapterId, verse.verseNumber]))
					.flatMap(verse => verse.words.map(word => word.lineNumber))
			);
			const byLine = new Map<number, QuranWord[]>();

			for (const verse of kept) {
				const words = [...verse.words].sort((a, b) => a.position - b.position);
				const ends = words.filter(word => word.charTypeName === 'end');

				if (ends.length !== 1 || words.at(-1)?.charTypeName !== 'end') {
					throw new Error(`${verse.verseKey}: expected exactly one end, and last; found ${ends.length}`);
				}

				/*
				 * **A verse's end mark sits on the line of its last word, never before it.** The API
				 * has been seen to report the mark a line early — 84:21's ٢١ came back on line 13
				 * while "عَلَيْهِمُ ٱلْقُرْءَانُ لَا يَسْجُدُونَ ۩" were on 14, so the reader set the
				 * number mid-verse, after "قُرِئَ". The words are the text and are never moved; the
				 * mark is placed, and a mark reported before its own verse's words is moved to them.
				 */
				const lastWordLine = Math.max(
					...words.filter(word => word.charTypeName !== 'end').map(word => word.lineNumber)
				);
				const end = ends[0];

				if (end && end.lineNumber < lastWordLine) {
					console.warn(
						`${verse.verseKey}: end mark reported on line ${end.lineNumber}, its last word on ${lastWordLine} — moved to ${lastWordLine}`
					);
					end.lineNumber = lastWordLine;
				}

				for (const word of words) {
					if (word.lineNumber < 1 || word.lineNumber > LINES_PER_PAGE) {
						throw new Error(`${verse.verseKey}: line ${word.lineNumber} on page ${page} is off the page`);
					}

					const line = byLine.get(word.lineNumber) ?? [];

					if (word.charTypeName === 'end') {
						line.push({ e: verse.verseNumber });
					} else {
						if (!word.textUthmani) {
							throw new Error(`${verse.verseKey} word ${word.position} came back without its text`);
						}

						const opensSura = verse.verseNumber === 1 && word.position === 1;

						line.push({
							t: word.textUthmani,
							...(opensSura ? { s: verse.chapterId } : {})
						});
					}

					byLine.set(word.lineNumber, line);
				}
			}

			const lines = [...byLine.entries()]
				.sort(([a], [b]) => a - b)
				.map<QuranLine>(([n, w]) => ({ n, w, ...(foreignLines.has(n) ? { partial: true as const } : {}) }));

			pages.push({
				lines,
				page,
				verses: kept.map(verse => ({ ayah: verse.verseNumber, chapter: verse.chapterId, key: verse.verseKey }))
			});
		}

		const verseCount = pages.reduce((count, page) => count + page.verses.length, 0);

		if (verseCount !== cuz.verseCount) {
			throw new Error(`Cüz ${cuz.number}: fetched ${verseCount} verses, metadata says ${cuz.verseCount}`);
		}

		if (pages.length !== cuz.pageCount) {
			throw new Error(`Cüz ${cuz.number}: ${pages.length} pages, metadata says ${cuz.pageCount}`);
		}

		total += verseCount;

		const fileName = `cuz-${String(cuz.number).padStart(2, '0')}.json`;

		// Compact rather than indented: the words are the bulk of the app's content, and
		// indentation would double the file for nobody's benefit.
		await writeFile(
			resolve(OUTPUT_DIR, fileName),
			`${JSON.stringify({
				cuz: cuz.number,
				meta: {
					edition: 'Madinah mushaf, per word in textUthmani (t), on its fifteen lines — as served',
					fetchedAt: new Date().toISOString().slice(0, 10),
					note: 'Generated by apps/server/scripts/fetch-quran-text.ts. Do not edit by hand; re-run the script.',
					source: 'Quran Foundation API via @quranjs/api'
				},
				pages
			})}\n`
		);

		console.log(`Cüz ${cuz.number}: ${pages.length} sayfa, ${verseCount} ayet → ${fileName}`);
	}

	if (total !== VERSE_COUNT) {
		throw new Error(`The thirty cüz hold ${total} verses, expected ${VERSE_COUNT}`);
	}

	console.log(`\nWrote ${CUZ_COUNT} cüz, ${total} verses, to ${OUTPUT_DIR}`);
};

main().catch(error => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
