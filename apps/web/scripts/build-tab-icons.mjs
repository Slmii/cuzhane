/**
 * Rasterises the five tab glyphs, resting and active, into the PNGs the **native** tab bar
 * needs.
 *
 * `@bottom-tabs/react-navigation` hands its icons to a real `UITabBar`, which takes an
 * `ImageSource` or an SF Symbol and cannot be given a React element — so `ui/Icon`'s SVGs,
 * which every other surface in the app renders directly, are the one thing that cannot reach
 * this bar. Before this the bar borrowed the nearest SF Symbols instead, which is how a tab
 * row ended up in a vocabulary the design system had never seen.
 *
 * They are drawn in solid black and shipped as **template images** (`iconRenderingMode` is
 * `automatic`, the default), so iOS recolours them from the navigator's active/inactive tints
 * and light and dark need no separate assets.
 *
 * Run with: `node scripts/build-tab-icons.mjs`
 *
 * **The `d`s below must match `GLYPHS` in `components/ui/Icon/Icon.component.tsx`.** They are
 * the same five pairs from the Icon Set's "Alt gezinme / Tab bar" section, and this is the
 * only other copy in the repo — change one and change the other.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'assets', 'tabs');

/** The design draws the tab glyph at 26 on a 24 grid; 28pt is the iOS tab bar's own size. */
const POINTS = 28;
const SCALES = [1, 2, 3];

const STROKE = 'fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const SOLID = 'fill="#000" stroke="none"';
const BOLD = 'fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"';

const GLYPHS = {
	home: `<g ${STROKE}><path d="M3.4 20.2h17.2"/><path d="M4.6 17.6V9.2"/><path d="M8.3 17.6V6"/><path d="M12 17.6V7.6"/><path d="M15.7 17.6V4.4"/><path d="M19.4 17.6V6.8"/></g>`,
	homeActive: `<g ${SOLID}><rect x="3.4" y="9.2" width="2.4" height="8.4" rx="1.2"/><rect x="7.1" y="6" width="2.4" height="11.6" rx="1.2"/><rect x="10.8" y="7.6" width="2.4" height="10" rx="1.2"/><rect x="14.5" y="4.4" width="2.4" height="13.2" rx="1.2"/><rect x="18.2" y="6.8" width="2.4" height="10.8" rx="1.2"/><rect x="3.4" y="19.1" width="17.2" height="2.2" rx="1.1"/></g>`,
	groups: `<g ${STROKE}><circle cx="8" cy="8.6" r="2.9"/><circle cx="16" cy="8.6" r="2.9"/><circle cx="12" cy="16.4" r="2.9"/></g>`,
	groupsActive: `<g ${SOLID}><circle cx="8" cy="8.6" r="3.1"/><circle cx="16" cy="8.6" r="3.1"/><circle cx="12" cy="16.4" r="3.1"/></g>`,
	discover: `<g ${STROKE}><circle cx="12" cy="12" r="8.6"/><path d="M15.6 8.4l-1.9 5.3-5.3 1.9 1.9-5.3z"/></g>`,
	discoverActive: `<g ${BOLD}><circle cx="12" cy="12" r="8.6"/></g><g ${SOLID}><path d="M15.6 8.4l-1.9 5.3-5.3 1.9 1.9-5.3z"/></g>`,
	reminders: `<g ${STROKE}><path d="M6.3 17h11.4l-1.7-2.4v-3.7a4 4 0 0 0-8 0v3.7z"/><path d="M10.2 20h3.6"/></g>`,
	remindersActive: `<g ${SOLID}><path d="M6.3 17h11.4l-1.7-2.4v-3.7a4 4 0 0 0-8 0v3.7z"/></g><g ${BOLD}><path d="M10.2 20h3.6"/></g>`,
	profile: `<g ${STROKE}><circle cx="12" cy="8.8" r="3.4"/><path d="M5.6 19.4a6.4 6.4 0 0 1 12.8 0"/></g>`,
	profileActive: `<g ${SOLID}><circle cx="12" cy="8.8" r="3.6"/><path d="M5.6 19.4a6.4 6.4 0 0 1 12.8 0z"/></g>`,
	search: `<g ${STROKE}><circle cx="11" cy="11" r="6.2"/><path d="M15.6 15.6L20 20"/></g>`,
	searchActive: `<g ${BOLD}><circle cx="11" cy="11" r="6.2"/><path d="M15.6 15.6L20 20"/></g>`
};

const CHROME = join(
	process.env.HOME,
	'Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-arm64/chrome-headless-shell'
);

const page = body => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${POINTS}" height="${POINTS}" viewBox="0 0 24 24">${body}</svg>`;

mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT)) {
	rmSync(join(OUT, file));
}

const tmp = join(HERE, '.tab-icon.html');

for (const [name, body] of Object.entries(GLYPHS)) {
	writeFileSync(tmp, page(body));

	for (const scale of SCALES) {
		const suffix = scale === 1 ? '' : `@${scale}x`;
		const out = join(OUT, `${name}${suffix}.png`);

		execFileSync(CHROME, [
			'--headless',
			'--disable-gpu',
			'--hide-scrollbars',
			'--default-background-color=00000000',
			`--force-device-scale-factor=${scale}`,
			`--window-size=${POINTS},${POINTS}`,
			`--screenshot=${out}`,
			`file://${tmp}`
		]);
		console.log(`${name}${suffix}.png`);
	}
}

rmSync(tmp);
console.log(`\n${Object.keys(GLYPHS).length * SCALES.length} files written to src/assets/tabs`);
