/**
 * Writes `src/lib/content/hizbulhakaik.data.json` from the publisher's text.
 *
 *   node scripts/build-hizbulhakaik.mts
 *
 * The source is `scripts/hizbulhakaik.txt`, committed beside this file: it is the same
 * delimited format the Cevşen came in from the Risale-i Nur Kütüphanesi app, and the parse
 * rules — with the tests that pin them — are `src/lib/content/hizbulhakaik.parse.ts`. This
 * file only reads, describes and writes.
 *
 * Plain TypeScript run under Node's own type stripping (22.18+), so it can import the parser
 * without a build step; that is also why the import spells out `.ts`. Node prints a
 * `MODULE_TYPELESS_PACKAGE_JSON` notice for that import — the parser is a `.ts` in a package
 * without `"type"`, so it is sniffed as ESM. Expected; do not answer it by adding `"type":
 * "module"` to the app's package.json, which Metro and the CommonJS configs are not built for.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { parseHizbulhakaik, type HizbSection } from '../src/lib/content/hizbulhakaik.parse.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, 'hizbulhakaik.txt');
const TARGET = resolve(here, '../src/lib/content/hizbulhakaik.data.json');

const sections = parseHizbulhakaik(readFileSync(SOURCE, 'utf8'));

/*
 * Âmenerresûlü (el-Bakara 2:285–286), which the Hizb calendar reads after Nebe and the
 * publisher's text does not carry. Its words are Quran Foundation's, kept verbatim in
 * `amenerrasulu.json` (whose `meta` says why imlaei); only the verse marks are set here, the
 * way this text sets them. One line, after Nebe's last verse and before the du'a.
 */
const AMENERRASULU = resolve(here, 'amenerrasulu.json');
const amenerrasulu: { verses: { key: string; text: string }[] } = JSON.parse(readFileSync(AMENERRASULU, 'utf8'));
const arabicDigits = (value: string) => value.replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)] ?? digit);
const nebe = sections.find(section => section.title === 'Nebe');
const nebeEnds = (nebe?.blocks ?? []).flatMap(block =>
	block.lines.flatMap((line, index) => (line.text.trimEnd().endsWith('﴿٤٠﴾') ? [{ block, index, line }] : []))
);
if (nebeEnds.length !== 1 || !nebeEnds[0]) {
	throw new Error(`Expected one line closing Nebe's ﴿٤٠﴾, found ${nebeEnds.length}`);
}
const { block: nebeBlock, index: nebeEnd, line: nebeLast } = nebeEnds[0];
nebeBlock.lines.splice(nebeEnd + 1, 0, {
	page: nebeLast.page,
	text: amenerrasulu.verses.map(verse => `${verse.text} ﴿${arabicDigits(verse.key.split(':')[1] ?? '')}﴾`).join(' ')
});

const count = (pick: (section: HizbSection) => number) => sections.reduce((sum, section) => sum + pick(section), 0);
const blockCount = count(section => section.blocks.length);
const lineCount = count(section => section.blocks.reduce((sum, block) => sum + block.lines.length, 0));
const pages = new Set(sections.flatMap(section => section.blocks.flatMap(block => block.lines.map(line => line.page))));
const pageRange = `${Math.min(...pages)}–${Math.max(...pages)}`;

const data = {
	meta: {
		text: 'Hizb-ü Envâr-ıl Hakâik-ın Nuriye',
		source: "Risale-i Nur Kütüphanesi (org.feyyaz.Risale-iNur-Kutuphanesi, FEYYAZ Bilim ve Gelişim Derneği) — the same app the Cevşen came from, whose books live under Documents/kitaplar/ in its container. The file's own name there was not recorded; the copy is scripts/hizbulhakaik.txt.",
		extraction:
			"The publisher's own delimited text, read verbatim by scripts/build-hizbulhakaik.mts: '#N' per printed page, '<…>' per section title, '~…|@' per line, '❁' between invocations, ',* * *>' where the print closes a bab or du'a. Nothing is reconstructed.",
		structure:
			"Sections hold blocks, blocks hold lines, and each line carries the page it is printed on. Pages are not a level of their own because a du'a runs across them: the print closes one with * * * at the foot of a page only 15 times in 242 pages, so a page break says nothing about where a du'a ends. Three sections (Haşir, Tebareke, Nebe) begin partway down a page. Empty pages are omitted; their numbers are simply absent.",
		marks: "The long î is written U+0656 (subscript alef), not the U+06EA the source file uses — the same swap cevsen.data.json makes, for the same reason: the face the reader renders with maps U+06EA onto its uni0656 glyph, and faces not in on that arrangement draw U+06EA as an empty diamond. Verse marks '﴿N﴾' and the invocation mark '❁' are kept in `text` as the source sets them; `invocations` is the same line split at ❁.",
		supplement:
			"Âmenerresûlü (el-Bakara 2:285–286) is not in the publisher's text; its words come verbatim from Quran Foundation (scripts/amenerrasulu.json, imlaei script) and are spliced into Nebe after its last verse, before the du'a.",
		verified: `${sections.length} sections, ${blockCount} blocks, ${lineCount} lines over ${pages.size} pages (${pageRange}). The Cevşen-ül Kebir section carries all hundred babs, closings ﴿١﴾ to ﴿١٠٠﴾, which is what checks it against cevsen.data.json.`
	},
	sections
};

// Through the repo's prettier so the file lands as `format:check` wants it — the only reason
// the committed file and a fresh build ever differed was line-wrapping.
const prettierConfig = prettier.resolveConfig.sync(TARGET) ?? {};
writeFileSync(TARGET, prettier.format(JSON.stringify(data), { ...prettierConfig, filepath: TARGET }));
console.log(`${TARGET}\n${data.meta.verified}`);
