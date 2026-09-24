import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { inflateSync } from 'node:zlib';

/**
 * Imports Hayrât Neşriyat's Ahmed Hüsrev hattı Tevâfuklu Kur'ân-ı Kerîm — **used with Hayrat
 * Vakfı's written permission** — from their "Kur'an-ı Kerim - iPad için" app, which runs on
 * Apple Silicon Macs. It is what the cüz reader shows when "Hüsrev hattı" is chosen.
 *
 * **Run by hand, on a Mac with that app installed.** Two outputs:
 *
 * - `apps/server/mushaf/page-000.png … page-604.png` — the 605 pages, 1024 × 1680, on a
 *   transparent ground — and `dua-1.png … dua-4.png`, the Hatim duası the app sets after the
 *   mushaf (its `hatimdua.html`, four plain PNGs in the same hand and format). **Gitignored**:
 *   91 MB of images do not belong in the repo. The dev API serves them at `/mushaf/…`; in
 *   production Caddy serves the same path.
 * - `apps/web/src/lib/content/mushaf.data.json` — which ayahs each page holds and which pages
 *   each cüz spans, from the app's own database. **Committed**, and small.
 *
 *     pnpm --filter @cuzhane/server mushaf:import [path/to/EZAudioPlayFileExample.app]
 *
 * What the app ships, and what this undoes:
 *
 * - **`Page.bundle/NNN.syf` is a PNG behind a fake RAR header.** The file opens `Rar!` and
 *   carries fifty bytes of padding where the PNG signature and the IHDR length belong; from
 *   the IHDR chunk to `IEND` it is an intact PNG. Putting the signature back is the whole
 *   recovery — nothing is decoded or re-encoded, so every pixel is theirs.
 * - **The files are numbered back to front**: `000.syf` is Nâs and `604.syf` is Fâtiha, so
 *   page `p` is file `604 − p` — right-to-left paging, done in the file names.
 * - **Pages are numbered from 0**, as the database numbers them: 0 is Fâtiha on its own framed
 *   page and Bakara opens page 1, so a cüz is twenty pages and the first holds twenty-one.
 * - **The cüz are their own**, not the Madinah mushaf's: every cüz here ends at the foot of a
 *   page, which moves eight boundaries by one to five ayahs (`Hizip` records them). Cüz 30
 *   runs to the last page — the table stops it at 600, which would orphan Nâs and the four
 *   before it.
 */

const DEFAULT_APP_PATH = "/Applications/Kur'an-ı Kerim - iPad için.app/Wrapper/EZAudioPlayFileExample.app";
const PAGES_DIR = resolve(import.meta.dirname, '../mushaf');
const DATA_PATH = resolve(import.meta.dirname, '../../web/src/lib/content/mushaf.data.json');

const LAST_PAGE = 604;
const CUZ_COUNT = 30;
const SURA_COUNT = 114;
const VERSE_COUNT = 6236;
/** The fourteen sajdah verses of the Hanafi count, which is what this edition marks. */
const SECDE_COUNT = 14;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_END = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
/** Every PNG's first chunk is IHDR, and its length field always reads 13. */
const IHDR_LENGTH = 13;

/** The Hatim duası: `hat_1.png … hat_4.png`, which the app's `hatimdua.html` stacks in order. */
const DUA_PAGE_COUNT = 4;

const pad = (n: number) => String(n).padStart(3, '0');

/** The PNG inside one `.syf`, or a thrown error naming the file if it isn't shaped as expected. */
const recoverPng = (bytes: Buffer, name: string) => {
	const ihdr = bytes.indexOf('IHDR');

	if (ihdr < 4 || bytes.readUInt32BE(ihdr - 4) !== IHDR_LENGTH || !bytes.subarray(-PNG_END.length).equals(PNG_END)) {
		throw new Error(`${name} is not a PNG behind a header — has the app changed its format?`);
	}

	return Buffer.concat([PNG_SIGNATURE, bytes.subarray(ihdr - 4)]);
};

/**
 * The pixels of one page, as palette indexes. Enough of PNG for these files and no more: 8-bit
 * indexed, non-interlaced — anything else throws rather than being misread.
 */
const decodeIndexedPng = (png: Buffer) => {
	let offset = PNG_SIGNATURE.length;
	let width = 0;
	let height = 0;
	let palette = Buffer.alloc(0);
	const compressed: Buffer[] = [];

	while (offset < png.length) {
		const length = png.readUInt32BE(offset);
		const type = png.toString('latin1', offset + 4, offset + 8);
		const data = png.subarray(offset + 8, offset + 8 + length);

		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);

			if (data[8] !== 8 || data[9] !== 3 || data[12] !== 0) {
				throw new Error('Expected an 8-bit indexed, non-interlaced PNG');
			}
		} else if (type === 'PLTE') {
			palette = data;
		} else if (type === 'IDAT') {
			compressed.push(data);
		} else if (type === 'IEND') {
			break;
		}

		offset += 12 + length;
	}

	// Undo each scanline's filter — one byte a pixel, so the "left" neighbour is the byte before.
	const raw = inflateSync(Buffer.concat(compressed));
	const pixels = Buffer.alloc(width * height);
	let previous = Buffer.alloc(width);

	for (let y = 0; y < height; y += 1) {
		const filter = raw[y * (width + 1)];
		const line = raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1));
		const row = pixels.subarray(y * width, (y + 1) * width);

		for (let x = 0; x < width; x += 1) {
			const left = x > 0 ? row[x - 1] ?? 0 : 0;
			const up = previous[x] ?? 0;
			const upLeft = x > 0 ? previous[x - 1] ?? 0 : 0;
			let predictor = 0;

			if (filter === 1) {
				predictor = left;
			} else if (filter === 2) {
				predictor = up;
			} else if (filter === 3) {
				predictor = (left + up) >> 1;
			} else if (filter === 4) {
				const estimate = left + up - upLeft;
				const toLeft = Math.abs(estimate - left);
				const toUp = Math.abs(estimate - up);
				const toUpLeft = Math.abs(estimate - upLeft);

				predictor = toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft;
			} else if (filter !== 0) {
				throw new Error(`Unknown PNG filter ${filter}`);
			}

			row[x] = ((line[x] ?? 0) + predictor) & 0xff;
		}

		previous = row;
	}

	return { height, palette, pixels, width };
};

/**
 * The sajdah highlight's green, as the edition prints it: one flat colour behind the verse,
 * edge to edge on the lines between. Its anti-aliased rim is a paler green and is not counted.
 */
const SECDE_GREEN = [0xd4, 0xff, 0xc2];
/** A row counts as highlighted with this many green pixels — a stray pixel is not a line. */
const SECDE_MIN_ROW_PIXELS = 20;
/** How far below the top of the highlight to look for its first line's extent. */
const SECDE_FIRST_LINE_ROWS = 40;

/**
 * Where a sajdah verse begins on its page: the **top-right corner of the highlight's first
 * line**, as fractions of the page. Right, because the verse runs right to left, so its first
 * word is at the right end of the first green stretch — which on most pages starts mid-line.
 */
const findSecdeStart = (png: Buffer, page: number) => {
	const { height, palette, pixels, width } = decodeIndexedPng(png);
	const greens = new Set<number>();

	for (let index = 0; index * 3 < palette.length; index += 1) {
		if (SECDE_GREEN.every((channel, offset) => palette[index * 3 + offset] === channel)) {
			greens.add(index);
		}
	}

	const greenInRow = (y: number) => {
		let count = 0;
		let right = -1;

		for (let x = 0; x < width; x += 1) {
			if (greens.has(pixels[y * width + x] ?? -1)) {
				count += 1;
				right = x;
			}
		}

		return { count, right };
	};

	let top = -1;

	for (let y = 0; y < height && top < 0; y += 1) {
		if (greenInRow(y).count >= SECDE_MIN_ROW_PIXELS) {
			top = y;
		}
	}

	if (top < 0) {
		throw new Error(`Page ${page} is listed as holding a sajdah verse but carries no highlight`);
	}

	let right = 0;

	for (let y = top; y < Math.min(height, top + SECDE_FIRST_LINE_ROWS); y += 1) {
		right = Math.max(right, greenInRow(y).right);
	}

	const round = (value: number) => Math.round(value * 10000) / 10000;

	return { x: round((right + 1) / width), y: round(top / height) };
};

type VerseRow = { sura: number; ayah: number; page: number };
type CuzRow = { cuz: number; first: number };
type SecdeRow = { page: number; ayah: number; sura: number };

const main = async () => {
	const appPath = process.argv[2] ?? DEFAULT_APP_PATH;
	const db = new DatabaseSync(join(appPath, 'HayratKuran.db'), { readOnly: true });

	const verses = db
		.prepare('SELECT SureNu AS sura, AyetNu AS ayah, SayfaNu AS page FROM Ayet ORDER BY AyetId')
		.all() as VerseRow[];
	const cuzRows = db.prepare('SELECT CuzNu AS cuz, HizipBir AS first FROM Hizip ORDER BY CuzNu').all() as CuzRow[];
	// The table names its sura only in Turkish, so the number comes from the ayah on that page.
	const secdeRows = db
		.prepare(
			`SELECT s.SayfaNu AS page, s.AyetNu AS ayah, a.SureNu AS sura
			 FROM Secde s JOIN Ayet a ON a.SayfaNu = s.SayfaNu AND a.AyetNu = s.AyetNu
			 ORDER BY s.SayfaNu`
		)
		.all() as SecdeRow[];

	db.close();

	if (secdeRows.length !== SECDE_COUNT) {
		throw new Error(`Expected ${SECDE_COUNT} sajdah verses, found ${secdeRows.length}`);
	}

	/*
	 * The whole Kuran, in order, once: every ayah follows the one before it or opens the next
	 * sura at 1, and no page number ever goes backwards. A table that fails this is not one to
	 * build a reader on.
	 */
	if (verses.length !== VERSE_COUNT) {
		throw new Error(`Expected ${VERSE_COUNT} ayahs, found ${verses.length}`);
	}

	verses.forEach((verse, index) => {
		const previous = verses[index - 1] ?? { ayah: 0, page: 0, sura: 1 };
		const isNext =
			(verse.sura === previous.sura && verse.ayah === previous.ayah + 1) ||
			(verse.sura === previous.sura + 1 && verse.ayah === 1);

		if (!isNext || verse.page < previous.page) {
			throw new Error(`Ayah ${verse.sura}:${verse.ayah} is out of order after ${previous.sura}:${previous.ayah}`);
		}
	});

	if (verses.at(-1)?.sura !== SURA_COUNT) {
		throw new Error(`The last ayah is not in sura ${SURA_COUNT}`);
	}

	// Per page: the first and last ayah it holds, as [sura, ayah, sura, ayah].
	const pages: [number, number, number, number][] = [];

	for (const verse of verses) {
		const page = pages[verse.page];

		if (page) {
			page[2] = verse.sura;
			page[3] = verse.ayah;
		} else {
			pages[verse.page] = [verse.sura, verse.ayah, verse.sura, verse.ayah];
		}
	}

	// By index, not `pages.some`: a page no ayah landed on is a *hole* in this array, and
	// `some` skips holes — so it would pass, and serialise as `null`.
	if (
		pages.length !== LAST_PAGE + 1 ||
		Array.from({ length: LAST_PAGE + 1 }, (_, page) => pages[page]).some(page => !page)
	) {
		throw new Error(`Expected every page 0–${LAST_PAGE} to hold an ayah`);
	}

	// Per cüz: its first and last page. Each ends where the next begins; the last, at the last page.
	if (
		cuzRows.length !== CUZ_COUNT ||
		cuzRows.some((row, index) => row.cuz !== index + 1) ||
		cuzRows[0]?.first !== 0
	) {
		throw new Error(`Expected cüz 1–${CUZ_COUNT}, the first opening page 0`);
	}

	const cuz = cuzRows.map((row, index) => {
		const last = (cuzRows[index + 1]?.first ?? LAST_PAGE + 1) - 1;

		if (last < row.first) {
			throw new Error(`Cüz ${row.cuz} ends before it begins`);
		}

		return [row.first, last];
	});

	await mkdir(PAGES_DIR, { recursive: true });

	let bytes = 0;
	const secde: [number, number, number, number, number][] = [];

	for (let page = 0; page <= LAST_PAGE; page += 1) {
		const name = `${pad(LAST_PAGE - page)}.syf`;
		const png = recoverPng(await readFile(join(appPath, 'Page.bundle', name)), name);

		await writeFile(join(PAGES_DIR, `page-${pad(page)}.png`), png);
		bytes += png.length;

		for (const row of secdeRows.filter(entry => entry.page === page)) {
			const start = findSecdeStart(png, page);

			secde.push([page, row.sura, row.ayah, start.x, start.y]);
		}
	}

	// Plain PNGs already, unlike the pages — copied as they are.
	for (let index = 1; index <= DUA_PAGE_COUNT; index += 1) {
		const png = await readFile(join(appPath, `hat_${index}.png`));

		if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
			throw new Error(`hat_${index}.png is not a PNG — has the app changed its format?`);
		}

		await writeFile(join(PAGES_DIR, `dua-${index}.png`), png);
		bytes += png.length;
	}

	const data = {
		meta: {
			edition: "Ahmed Hüsrev hattı Tevâfuklu Kur'ân-ı Kerîm — Hayrât Neşriyat",
			permission: 'Used with the written permission of Hayrat Vakfı.',
			source: 'HayratKuran.db from the "Kur\'an-ı Kerim - iPad için" app, via scripts/import-hayrat-mushaf.ts',
			pages: 'Numbered from 0 (Fâtiha). Each entry is [firstSura, firstAyah, lastSura, lastAyah].',
			cuz: "Each entry is [firstPage, lastPage], inclusive — the edition's own cüz, whole pages.",
			secde: 'The sajdah verses, each [page, sura, ayah, x, y]: x and y are where its green highlight begins — the top-right corner of its first line — as fractions of the page, read from the pixels.'
		},
		cuz,
		pages,
		secde
	};

	await writeFile(DATA_PATH, `${JSON.stringify(data, null, '\t')}\n`);

	console.log(
		`Wrote ${LAST_PAGE + 1} pages and ${DUA_PAGE_COUNT} du'a pages (${(bytes / 1e6).toFixed(1)} MB) to ${PAGES_DIR}`
	);
	console.log(`Wrote ${DATA_PATH}`);
};

await main();
