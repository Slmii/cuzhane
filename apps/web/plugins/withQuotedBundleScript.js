const { withXcodeProject } = require('expo/config-plugins');

/**
 * Quotes the path in the "Bundle React Native code and images" build phase.
 *
 * Expo's iOS template ends that phase with
 *
 *   `"$NODE_BINARY" --print "…react-native-xcode.sh"`
 *
 * — a bare command substitution, so the path it prints is word-split before it is run. In a
 * checkout whose path has a space (`…/Private Repos/cuzhane`) the build stops at
 * `/Users/…/Private: No such file or directory`. Wrapping the substitution in double quotes
 * is the whole fix; the same one the two podspec patches in `patches/` make for
 * `expo-constants` and `expo-updates`, whose script phases have the same flaw.
 *
 * A config plugin rather than an edit to `ios/`, because `ios/` is generated and gitignored:
 * anything changed there by hand is gone at the next `prebuild`. It matches the exact template
 * text and does nothing when that text is absent, so a template that fixes this upstream
 * makes it a no-op rather than a conflict.
 */
const UNQUOTED =
	"`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`";
const QUOTED =
	'\\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"';

module.exports = config =>
	withXcodeProject(config, config => {
		const phases = config.modResults.hash.project.objects.PBXShellScriptBuildPhase ?? {};

		for (const phase of Object.values(phases)) {
			if (
				typeof phase === 'object' &&
				typeof phase.shellScript === 'string' &&
				phase.shellScript.includes(UNQUOTED)
			) {
				phase.shellScript = phase.shellScript.replace(UNQUOTED, QUOTED);
			}
		}

		return config;
	});
