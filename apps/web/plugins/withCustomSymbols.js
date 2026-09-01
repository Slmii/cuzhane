const { withDangerousMod } = require('expo/config-plugins');
const { cpSync, existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Copies our custom SF Symbols into the iOS asset catalog at prebuild.
 *
 * **This exists because `ios/` is generated and gitignored.** The app is CNG, so the asset
 * catalog Xcode compiles is rebuilt from the config every time — anything dropped into it by
 * hand disappears at the next `prebuild`. The symbol sets therefore live in the repo, under
 * `src/assets/symbols`, and are copied in here so they survive regeneration.
 *
 * A `.symbolset` is a folder holding one SVG and a `Contents.json`, and `Images.xcassets` is
 * already a bundled resource, so a plain directory copy is the whole job — no `pbxproj` edit is
 * needed and `withXcodeProject` would only add a way to corrupt the project file.
 *
 * The catalog's own `Contents.json` is deliberately **not** copied over: the destination has one
 * describing the whole catalog, and replacing it with the one from our little collection would
 * throw away every other asset's entry.
 *
 * What lands here is consumed by `ui/Button/GlassButton` as `Image assetName`, which is how a
 * native SwiftUI button can draw our own traced glyphs instead of Apple's nearest equivalent.
 * The names are the source SVG filenames — `tamam-check`, `geri-al-undo` — so a symbol can
 * always be traced back to the drawing it came from.
 */
const SYMBOLS_DIR = join('src', 'assets', 'symbols', 'CuzhaneSymbols.xcassets');

const withCustomSymbols = config =>
	withDangerousMod(config, [
		'ios',
		async dangerousConfig => {
			const { platformProjectRoot, projectName, projectRoot } = dangerousConfig.modRequest;
			const source = join(projectRoot, SYMBOLS_DIR);

			if (!existsSync(source)) {
				throw new Error(`[withCustomSymbols] no symbols at ${source}`);
			}

			const destination = join(platformProjectRoot, projectName, 'Images.xcassets');

			if (!existsSync(destination)) {
				throw new Error(`[withCustomSymbols] no asset catalog at ${destination}`);
			}

			const sets = readdirSync(source).filter(entry => entry.endsWith('.symbolset'));

			for (const set of sets) {
				cpSync(join(source, set), join(destination, set), { recursive: true });
			}

			console.log(`[withCustomSymbols] copied ${sets.length} symbol set(s) into ${projectName}/Images.xcassets`);

			return dangerousConfig;
		}
	]);

module.exports = withCustomSymbols;
