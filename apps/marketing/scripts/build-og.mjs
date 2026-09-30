/**
 * Renders the share cards in `public/` from the design's `OG Images.dc.html`, with the
 * design-tool bindings resolved and the fonts and screenshots inlined so the render never
 * touches the network.
 *
 * `pnpm --filter @cuzhane/marketing og`. These are committed artefacts — the build does not run
 * this — so re-run it whenever the copy, the palette or the screenshots change, and commit the
 * PNGs.
 *
 * Four cards per language, as the design draws them:
 *   • `og-<locale>.png` — the main card, the one every page of the site uses;
 *   • `og/cevsen-<locale>.png`, `og/quran-<locale>.png`, `og/hizb-<locale>.png` — one per
 *     reading, for sharing a single kind by hand. The site has no page of its own for each, so
 *     nothing links them yet.
 * `og-square.png` is not in the new design and is kept as it was: the brand at 1:1 for
 * WhatsApp's chat list and schema.org's logo.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* The fonts are the workspace's own @fontsource packages, hoisted to the repo root by pnpm. */
const NM = path.resolve(HERE, '../../../node_modules');
const ASSETS = path.resolve(HERE, '../src/assets');
const OUT = process.argv[2] ?? path.resolve(HERE, '../public');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/*
 * **Both subsets, each with its range.** @fontsource splits a face into `latin` and `latin-ext`
 * files; the extended one holds ş, ğ and ü's cousins but not a single plain letter, so loading
 * it alone set every ASCII character in a fallback serif.
 */
const LATIN =
	'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
	'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const face = (file, family, weight, range) =>
	`@font-face{font-family:'${family}';font-weight:${weight};font-display:block;unicode-range:${range};src:url(data:font/woff2;base64,${fs
		.readFileSync(file)
		.toString('base64')}) format('woff2')}`;

const both = (dir, stem, family, weight) =>
	face(`${NM}/${dir}/files/${stem.replace('SUBSET', 'latin')}`, family, weight, LATIN) +
	face(`${NM}/${dir}/files/${stem.replace('SUBSET', 'latin-ext')}`, family, weight, LATIN_EXT);

const FONTS = [
	both('@fontsource-variable/newsreader', 'newsreader-SUBSET-wght-normal.woff2', 'Newsreader', '200 800'),
	both('@fontsource-variable/manrope', 'manrope-SUBSET-wght-normal.woff2', 'Manrope', '200 800'),
	both('@fontsource/ibm-plex-mono', 'ibm-plex-mono-SUBSET-500-normal.woff2', 'IBM Plex Mono', '500')
].join('');

/** A screenshot from `src/assets`, inlined — the same files the site's sections use. */
const shot = name => `data:image/png;base64,${fs.readFileSync(path.join(ASSETS, name)).toString('base64')}`;

/** The brand mark, lifted verbatim from the design. `accent` is the lighter bars' colour. */
const mark = (size, fill, accent) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block;flex:none">
		<rect x="8" y="42" width="12" height="38" rx="6" fill="${fill}"/>
		<rect x="26" y="26" width="12" height="54" rx="6" fill="${fill}"/>
		<rect x="44" y="34" width="12" height="46" rx="6" fill="${accent}"/>
		<rect x="62" y="18" width="12" height="62" rx="6" fill="${fill}"/>
		<rect x="80" y="48" width="12" height="32" rx="6" fill="${accent}"/>
		<rect x="8" y="86" width="84" height="8" rx="4" fill="${fill}"/>
	</svg>`;

/** The design's own `LOC` table. */
const COPY = {
	tr: {
		kQuran: "Kur'an hatmi",
		mainTitle: 'Payını oku, birlikte tamamla.',
		cvTitle: 'Yüz bab, gruba paylaşılmış bir tur.',
		cvUnit: '100 bab · haftalık tur',
		qTitle: 'Otuz cüz, bir hatim, birlikte.',
		qUnit: '30 cüz · bir hatim',
		hTitle: 'Her güne bir porsiyon; sayıyı uygulama tutar.',
		hUnit: '33 günlük plan · tekrar sayacı'
	},
	en: {
		kQuran: 'Quran hatim',
		mainTitle: 'Read your share, finish it together.',
		cvTitle: 'A hundred babs, one round, shared by the group.',
		cvUnit: '100 babs · weekly round',
		qTitle: 'Thirty juz, one hatim, together.',
		qUnit: '30 juz · one hatim',
		hTitle: 'A portion for every day. The app keeps count.',
		hUnit: '33-day plan · repeat counter'
	},
	nl: {
		kQuran: 'Koran-hatim',
		mainTitle: 'Lees je deel, maak het samen af.',
		cvTitle: 'Honderd babs, één ronde, verdeeld over de groep.',
		cvUnit: '100 babs · wekelijkse ronde',
		qTitle: 'Dertig juz, één hatim, samen.',
		qUnit: '30 juz · één hatim',
		hTitle: 'Elke dag een portie. De app houdt de telling bij.',
		hUnit: 'plan van 33 dagen · herhalingsteller'
	}
};

/*
 * **`lang` is load-bearing here, not decoration.** The kind labels are set in
 * `text-transform: uppercase`, and Turkish casing is not the default one: a dotted `i` must
 * uppercase to `İ`, so without a Turkish `lang` Chrome would bake "HIZBÜ'L-HAKAIK" into a PNG
 * nobody can re-case later.
 */
const shell = (lang, w, h, body) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
${FONTS}
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;-webkit-font-smoothing:antialiased;color:#1C1D1A}
</style></head><body>${body}</body></html>`;

/** The phone on the right of every card: the screen's top, running off the card's foot. */
const phone = (file, shadow) => `<div style="position:relative">
	<div style="position:absolute;left:40px;top:64px;width:320px;border-radius:40px 40px 0 0;box-shadow:0 0 0 9px #16171A,${shadow};overflow:hidden">
		<img src="${shot(file)}" style="display:block;width:100%;height:auto">
	</div>
</div>`;

const card = (background, left, right) =>
	`<div style="width:1200px;height:630px;background:${background};overflow:hidden;position:relative;display:grid;grid-template-columns:1fr 420px;padding:0 0 0 76px">${left}${right}</div>`;

const main = c =>
	card(
		'#3E6B5C',
		`<div style="display:flex;flex-direction:column;justify-content:center;gap:26px;padding-right:20px">
			<div style="display:flex;align-items:center;gap:14px">
				${mark(44, '#F7F5F0', '#8FB8A6')}
				<span style="font:400 34px/1 Newsreader,serif;color:#fff">Cüzhane</span>
			</div>
			<div style="font:400 76px/1.02 Newsreader,serif;letter-spacing:-.02em;color:#fff;text-wrap:pretty">${c.mainTitle}</div>
			<div style="display:flex;gap:10px;flex-wrap:wrap">
				${['Cevşen', c.kQuran, "Hizbü'l-Hakaik"]
					.map(
						label =>
							`<span style="font:500 17px Manrope,sans-serif;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.26);border-radius:99px;padding:9px 18px">${label}</span>`
					)
					.join('')}
			</div>
		</div>`,
		phone('20-home.png', '0 -10px 60px rgba(0,0,0,.3)')
	);

/** One reading's card: its wash, its label in its own ink, its title and its unit. */
const kind = ({ background, file, label, labelInk, title, unit, unitInk }) =>
	card(
		background,
		`<div style="display:flex;flex-direction:column;justify-content:center;gap:24px;padding-right:20px">
			<div style="display:flex;align-items:center;gap:12px">
				${mark(36, '#3E6B5C', '#8FB8A6')}
				<span style="font:400 28px/1 Newsreader,serif">Cüzhane</span>
			</div>
			<span style="font:600 18px Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${labelInk}">${label}</span>
			<div style="font:400 68px/1.04 Newsreader,serif;letter-spacing:-.02em;text-wrap:pretty">${title}</div>
			<span style="font:500 20px 'IBM Plex Mono',monospace;color:${unitInk}">${unit}</span>
		</div>`,
		phone(file, '0 -10px 50px rgba(28,29,26,.2)')
	);

const KINDS = c => ({
	cevsen: {
		background: '#E6EEE9',
		file: '21-cevsen-group.png',
		label: 'Cevşen',
		labelInk: '#3E6B5C',
		title: c.cvTitle,
		unit: c.cvUnit,
		unitInk: '#2F5347'
	},
	quran: {
		background: '#F0EBE2',
		file: '23-quran-group.png',
		label: c.kQuran,
		labelInk: '#6E5B3E',
		title: c.qTitle,
		unit: c.qUnit,
		unitInk: '#5A4A32'
	},
	hizb: {
		background: '#F3E8E5',
		file: '27-hizb-counter.png',
		label: "Hizbü'l-Hakaik",
		labelInk: '#8A4A43',
		title: c.hTitle,
		unit: c.hUnit,
		unitInk: '#7A3F39'
	}
});

fs.mkdirSync(path.join(OUT, 'og'), { recursive: true });
const tmp = fs.mkdtempSync('/tmp/og-');

const render = (name, html) => {
	const file = path.join(tmp, `${name.replace('/', '-')}.html`);
	fs.writeFileSync(file, html);
	execFileSync(
		CHROME,
		[
			'--headless',
			'--disable-gpu',
			'--hide-scrollbars',
			'--force-device-scale-factor=1',
			'--window-size=1200,630',
			`--screenshot=${path.join(OUT, `${name}.png`)}`,
			`file://${file}`
		],
		{ stdio: 'pipe' }
	);
	console.log(`  ${name}.png`);
};

for (const [locale, copy] of Object.entries(COPY)) {
	render(`og-${locale}`, shell(locale, 1200, 630, main(copy)));

	for (const [key, spec] of Object.entries(KINDS(copy))) {
		render(`og/${key}-${locale}`, shell(locale, 1200, 630, kind(spec)));
	}
}
