/**
 * Renders the share cards in `public/og-*.png` from the design's `OG Images.dc.html`, with the
 * design-tool bindings resolved and the fonts inlined so the render never touches the network.
 *
 * `pnpm --filter @cuzhane/marketing og`. These are committed artefacts — the build does not run
 * this — so re-run it whenever the copy, the palette or the mark changes, and commit the PNGs.
 *
 * Two departures from the prototype's data, both deliberate and both noted in the report:
 *   • the three stats are product facts rather than invented usage numbers, because a share
 *     card carries no framing that would read "12 active groups" as an illustration;
 *   • Dutch is added, since the site ships three languages and the prototype only wrote two.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* The fonts are the workspace's own @fontsource packages, hoisted to the repo root by pnpm. */
const NM = path.resolve(HERE, '../../../node_modules');
const OUT = process.argv[2] ?? path.resolve(HERE, '../public');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const font = (file, family, weight) =>
	`@font-face{font-family:'${family}';font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${fs
		.readFileSync(file)
		.toString('base64')}) format('woff2')}`;

const FONTS = [
	font(`${NM}/@fontsource-variable/newsreader/files/newsreader-latin-ext-wght-normal.woff2`, 'Newsreader', '200 800'),
	font(`${NM}/@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2`, 'Manrope', '200 800')
].join('');

/** The brand mark, lifted verbatim from the design. `a` is the accent bar colour. */
const mark = (size, fill, accent) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block;flex:none">
		<rect x="8" y="42" width="12" height="38" rx="6" fill="${fill}"/>
		<rect x="26" y="26" width="12" height="54" rx="6" fill="${fill}"/>
		<rect x="44" y="34" width="12" height="46" rx="6" fill="${accent}"/>
		<rect x="62" y="18" width="12" height="62" rx="6" fill="${fill}"/>
		<rect x="80" y="48" width="12" height="32" rx="6" fill="${accent}"/>
		<rect x="8" y="86" width="84" height="8" rx="4" fill="${fill}"/>
	</svg>`;

const COPY = {
	tr: {
		eyebrow: 'Grup halinde cevşen takibi',
		title: 'Payını oku,\nturu birlikte tamamla',
		sub: 'Grubunu kur, babları havuzdan dağıt, kimin nerede kaldığını tek ekranda gör.',
		poolCap: 'Cevşen havuzu',
		poolNote: 'bab tamamlandı',
		stats: [
			{ v: '100', l: 'Bab · bir tur' },
			{ v: '3', l: 'Dil' },
			{ v: '0', l: 'Reklam' }
		]
	},
	en: {
		eyebrow: 'Group reading, tracked',
		title: 'Read your share,\nfinish the round together',
		sub: 'Start a group, hand out babs from the pool, and see where everyone stands on one screen.',
		poolCap: 'Cevşen pool',
		poolNote: 'bab complete',
		stats: [
			{ v: '100', l: 'Babs · one round' },
			{ v: '3', l: 'Languages' },
			{ v: '0', l: 'Ads' }
		]
	},
	nl: {
		eyebrow: 'Samen lezen, bijgehouden',
		title: 'Lees je deel,\nmaak de ronde samen af',
		sub: 'Begin een groep, verdeel de babs uit de pool en zie op één scherm hoe iedereen ervoor staat.',
		poolCap: 'Cevşen-pool',
		poolNote: 'babs gelezen',
		stats: [
			{ v: '100', l: 'Babs · één ronde' },
			{ v: '3', l: 'Talen' },
			{ v: '0', l: 'Advertenties' }
		]
	}
};

/** 68 read, the next 14 claimed, the rest still in the pool — the prototype's own split. */
const board = () =>
	Array.from({ length: 100 }, (_, i) => {
		const bg = i < 68 ? '#fff' : i < 82 ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.16)';
		return `<span style="aspect-ratio:1;border-radius:4px;background:${bg}"></span>`;
	}).join('');

/*
 * **`lang` is load-bearing here, not decoration.** These cards set their eyebrows and stat
 * labels in `text-transform: uppercase`, and Turkish casing is not the default one: a dotless
 * `i` must uppercase to `İ`, so without a Turkish `lang` Chrome renders "TAKIBI" and "BİR TUR"
 * as "TAKIBI" and "BIR TUR" — visibly wrong words baked into a PNG nobody can re-case later.
 */
const shell = (lang, w, h, body) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
${FONTS}
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden}
</style></head><body>${body}</body></html>`;

const wide = (lang, c) =>
	shell(
		lang,
		1200,
		630,
		`
<div style="width:1200px;height:630px;background:#3E6B5C;position:relative;overflow:hidden;display:grid;grid-template-columns:1fr 400px;color:#fff">
	<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 88% 12%, rgba(255,255,255,.10), rgba(255,255,255,0) 60%)"></div>
	<div style="position:relative;padding:64px 0 60px 72px;display:flex;flex-direction:column;justify-content:space-between">
		<div style="display:flex;align-items:center;gap:14px">
			${mark(38, '#fff', '#A9CBBB')}
			<span style="font:400 30px/1 Newsreader,serif;letter-spacing:-.01em">Cüzhane</span>
		</div>
		<div>
			<div style="font:500 12px Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.6)">${
				c.eyebrow
			}</div>
			<div style="font:400 62px/1.08 Newsreader,serif;letter-spacing:-.02em;margin-top:20px;max-width:640px;white-space:pre-line">${
				c.title
			}</div>
			<div style="font:400 20px/1.55 Manrope,sans-serif;color:rgba(255,255,255,.76);margin-top:20px;max-width:520px">${
				c.sub
			}</div>
		</div>
		<div style="display:flex;align-items:center;gap:26px">
			${c.stats
				.map(
					s => `<div style="display:flex;flex-direction:column;gap:5px">
				<span style="font:400 30px/1 Newsreader,serif">${s.v}</span>
				<span style="font:500 10.5px Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.58)">${s.l}</span>
			</div>`
				)
				.join('')}
		</div>
	</div>
	<div style="position:relative;display:flex;align-items:center;justify-content:center;padding-right:64px">
		<div style="width:300px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);border-radius:26px;padding:26px 24px 22px">
			<div style="font:500 10.5px Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.66)">${
				c.poolCap
			}</div>
			<div style="display:grid;grid-template-columns:repeat(10,1fr);gap:5px;margin-top:16px">${board()}</div>
			<div style="display:flex;align-items:baseline;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.18)">
				<span style="font:400 26px/1 Newsreader,serif">68 / 100</span>
				<span style="font:500 11px Manrope,sans-serif;color:rgba(255,255,255,.66)">${c.poolNote}</span>
			</div>
		</div>
	</div>
</div>`
	);

/*
 * The square is language-neutral on purpose: it is WhatsApp's chat-list thumbnail and
 * schema.org's logo, both of which show it small and beside text that already says which
 * language the page is in. A headline set at this size would be unreadable there anyway.
 */
const square = () =>
	shell(
		'tr',
		1200,
		1200,
		`
<div style="width:1200px;height:1200px;background:#3E6B5C;color:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:64px;padding:96px">
	<div style="position:absolute;inset:0;background:radial-gradient(100% 70% at 50% 0%, rgba(255,255,255,.10), rgba(255,255,255,0) 62%)"></div>
	<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:28px">
		${mark(112, '#fff', '#A9CBBB')}
		<span style="font:400 76px/1 Newsreader,serif;letter-spacing:-.015em">Cüzhane</span>
	</div>
	<div style="position:relative;width:470px;display:grid;grid-template-columns:repeat(10,1fr);gap:8px">${board()}</div>
	<div style="position:relative;font:500 16px Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.58)">cuzhane.sbytes-it.com</div>
</div>`
	);

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync('/tmp/og-');

const render = (name, html, w, h) => {
	const file = path.join(tmp, `${name}.html`);
	fs.writeFileSync(file, html);
	execFileSync(
		CHROME,
		[
			'--headless',
			'--disable-gpu',
			'--hide-scrollbars',
			'--force-device-scale-factor=1',
			`--window-size=${w},${h}`,
			`--screenshot=${path.join(OUT, `${name}.png`)}`,
			`file://${file}`
		],
		{ stdio: 'pipe' }
	);
	console.log(`  ${name}.png`);
};

for (const [locale, copy] of Object.entries(COPY)) render(`og-${locale}`, wide(locale, copy), 1200, 630);
render('og-square', square(), 1200, 1200);
