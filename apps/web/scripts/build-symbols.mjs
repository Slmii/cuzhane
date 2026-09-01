/**
 * Turns the design system's icon SVGs into custom SF Symbols, for the native controls that can
 * only take one.
 *
 * A SwiftUI button draws an SF Symbol, not our `ui/Icon`, so a glyph on a glass button has to
 * exist as a symbol set or the button falls back to the drawn path. This produces those sets;
 * `plugins/withCustomSymbols.js` copies them into the generated iOS catalog at prebuild.
 *
 *   node scripts/build-symbols.mjs <icon.svg>
 *   node scripts/build-symbols.mjs <svg-dir> --only=tamam-check,ileri-chevron
 *   node scripts/build-symbols.mjs <svg-dir> --all
 *
 * `<svg-dir>` is the design system's icon export — the same drawings `ui/Icon` is traced from,
 * one 24-grid stroke-only SVG per glyph, named `<turkish>-<english>.svg`. It is **not in the
 * repo**: the export lands wherever it was downloaded, and the symbol sets this produces are
 * what gets committed. Point it at the current export.
 *
 * **Naming the glyphs is required**, and `--all` is the deliberate exception. Everything in the
 * catalog ships in the binary and a symbol set runs 60–660 KB, so converting the whole icon
 * folder puts ten megabytes of unreferenced artwork in the app — which is exactly what happened
 * the first time this ran. Only glyphs that appear on a native control need to exist here; the
 * rest are drawn by `ui/Icon` from the same SVGs at no cost at all.
 *
 * **Existing symbol sets are skipped** either way, so re-running after adding one icon converts
 * only that icon. `--force` rebuilds what is already there, which is what you want if the
 * conversion flags below change.
 *
 * The tool is `EasySymbols` (Apache-2.0, github.com/icodesign/EasySymbols). It is **not on npm**,
 * so this clones and builds it into a temp directory per run and deletes it afterwards rather
 * than vendoring a toolchain nobody would otherwise look at. That costs a clone; it is a script
 * run when an icon changes, not part of any build.
 *
 * Two flags are load-bearing and neither is the default:
 *
 * - `--geometry centerline`. On `auto` the tool produced a **single** Regular-M master, because
 *   our SVGs declare no `stroke-width` and it could not tell centerline artwork from filled.
 *   Forced, it synthesises the full 9 weights × 3 optical scales — which is the entire reason to
 *   use a symbol rather than a PNG.
 * - `--stroke-scale 1.6`. The sources default to a stroke width of 1; 1.6 is the icon set's
 *   resting weight, so the Regular master matches what the app draws.
 *
 * **Filled artwork cannot be converted and is skipped by name.** The tab bar's active variants,
 * the brand mark and the app icons are solid shapes, not centreline strokes; the tool rejects
 * them with CENTERLINE_GEOMETRY_REQUIRED. None of them wants to be a symbol anyway — the tab bar
 * ships PNGs from `build-tab-icons.mjs` and an app icon is not a glyph.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'assets', 'symbols', 'CuzhaneSymbols.xcassets');
const REPO = 'https://github.com/icodesign/EasySymbols.git';

/** Solid artwork the converter refuses, and which has no business being a symbol. */
const NOT_CENTERLINE = new Set([
	'ana-sayfa-home-filled',
	'cuzhane-isareti',
	'gruplarim-groups-filled',
	'hatirlatma-reminders-filled',
	'kesfet-discover-filled',
	'profil-profile-filled',
	'uygulama-simgesi-acik',
	'uygulama-simgesi-koyu'
]);

const args = process.argv.slice(2);
const inputPath = args.find(arg => !arg.startsWith('--'));
const isForced = args.includes('--force');
const isAll = args.includes('--all');
const onlyArg = args.find(arg => arg.startsWith('--only'));
const only = onlyArg ? new Set(onlyArg.split('=')[1]?.split(',') ?? []) : null;

/*
 * A single `.svg` names its own glyph, so `--only` would be repeating the filename. A directory
 * has to be told which of its fifty to convert — see the note at the top about why `--all` is a
 * decision rather than a default.
 */
const isSingleFile = inputPath !== undefined && inputPath.endsWith('.svg');

if (!inputPath || (!isSingleFile && !only && !isAll)) {
	console.error('usage: node scripts/build-symbols.mjs <icon.svg> [--force]');
	console.error('       node scripts/build-symbols.mjs <svg-dir> --only=a,b [--force]');
	console.error('       node scripts/build-symbols.mjs <svg-dir> --all [--force]');
	console.error('\nName the glyphs. --all converts the whole folder and ships every one of them.');
	process.exit(1);
}

const input = resolve(inputPath);

if (!existsSync(input)) {
	console.error(`no such path: ${input}`);
	process.exit(1);
}

// One file or a folder, the rest of the script only cares about a directory and a list of names.
const source = isSingleFile ? dirname(input) : input;
const names = isSingleFile
	? [basename(input, '.svg')]
	: readdirSync(input)
			.filter(file => file.endsWith('.svg'))
			.map(file => file.replace(/\.svg$/, ''));

mkdirSync(OUT, { recursive: true });

const candidates = names
	.filter(name => !NOT_CENTERLINE.has(name))
	.filter(name => (only ? only.has(name) : true))
	.filter(name => isForced || !existsSync(join(OUT, `${name}.symbolset`)))
	.sort();

/*
 * **Filled artwork is rejected here rather than after the clone.** The converter needs stroke
 * geometry to synthesise the weights, and hands back CENTERLINE_GEOMETRY_REQUIRED for anything
 * else — but only after this script has cloned and built it, which is a minute spent to learn
 * something readable from the file itself. `NOT_CENTERLINE` catches the ones known by name;
 * this catches everything else, including a one-off like Google's logo.
 *
 * The test is deliberately crude: a `fill` that is not `none` means painted shapes. Our icons
 * declare `fill="none"` on the root and stroke every path.
 */
const filled = candidates.filter(name => /fill="(?!none)[^"]+"/.test(readFileSync(join(source, `${name}.svg`), 'utf8')));

if (filled.length > 0) {
	console.error(`filled artwork cannot become a symbol: ${filled.join(', ')}`);
	console.error('\nA symbol is stroke geometry, and a custom one is a single-colour template.');
	console.error('Multi-colour marks (a brand logo) have to ship as an image instead.');
	process.exit(1);
}

if (candidates.length === 0) {
	console.log('nothing to convert — every symbol already exists (pass --force to rebuild)');
	process.exit(0);
}

console.log(`converting ${candidates.length} symbol(s)`);

const work = mkdtempSync(join(tmpdir(), 'easysymbols-'));

try {
	execFileSync('git', ['clone', '--depth', '1', REPO, join(work, 'EasySymbols')], { stdio: 'inherit' });

	const tool = join(work, 'EasySymbols');

	/*
	 * The tool is a Bun workspace and Bun may not be installed. pnpm understands the same
	 * `workspace:*` protocol, but refuses a project pinned to another package manager — so the
	 * pin is stripped from the throwaway clone. `pnpm-workspace.yaml` is what pnpm reads instead
	 * of package.json's `workspaces` field.
	 */
	const manifestPath = join(tool, 'package.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

	delete manifest.packageManager;
	delete manifest.engines;
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
	writeFileSync(join(tool, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n  - "packages/*"\n');

	execFileSync('pnpm', ['install', '--ignore-scripts'], { cwd: tool, stdio: 'inherit' });
	execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], {
		cwd: join(tool, 'packages', 'core'),
		stdio: 'inherit'
	});
	execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], {
		cwd: join(tool, 'apps', 'cli'),
		stdio: 'inherit'
	});

	const manifestFile = join(work, 'manifest.json');

	writeFileSync(
		manifestFile,
		JSON.stringify({
			name: 'CuzhaneSymbols',
			symbols: candidates.map(name => ({ name, source: join(source, `${name}.svg`) }))
		})
	);

	const built = join(work, 'out.xcassets');

	execFileSync(
		'node',
		[
			join(tool, 'apps', 'cli', 'dist', 'main.js'),
			'collection',
			manifestFile,
			'-o',
			built,
			'--format',
			'xcassets',
			'--force',
			'--geometry',
			'centerline',
			'--variants',
			'all',
			'--stroke-scale',
			'1.6'
		],
		{ stdio: 'inherit' }
	);

	// Only the symbol sets. The catalog's own `Contents.json` describes the whole catalog, and
	// copying this run's version over it would drop every symbol the run didn't build.
	for (const entry of readdirSync(built).filter(name => name.endsWith('.symbolset'))) {
		cpSync(join(built, entry), join(OUT, entry), { recursive: true });
	}

	console.log(`\n${candidates.length} symbol set(s) written to src/assets/symbols`);
	console.log('run `npx expo prebuild -p ios` to copy them into the iOS catalog');
} catch (error) {
	/*
	 * `execFileSync` throws on any non-zero exit, and an uncaught one prints a Node stack trace
	 * with the child's `pid` and `signal` — burying the converter's own message, which it had
	 * already written to stderr and which is the only useful line. Caught here the run ends on
	 * that message instead.
	 */
	console.error(`\n${error instanceof Error ? error.message : String(error)}`);
	console.error('\nthe converter’s own error is above this stack, in its output');
	process.exitCode = 1;
} finally {
	rmSync(work, { force: true, recursive: true });
}
