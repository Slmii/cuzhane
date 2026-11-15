import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * What version of the app this is — **one answer, read from the build**.
 *
 * `app.json` is the single source. Profil's version row and the release notes both come from
 * here, because they were two independent readings before: the row read `expoConfig`, the notes
 * carried a hand-written string, and bumping one without the other put "1.0.1" and "Sürüm 1.0.2"
 * a row apart on the same card.
 *
 * **Null when the manifest cannot be read**, which is a state the callers have to handle rather
 * than paper over with a plausible-looking default: a made-up version would be compared against
 * what the install has recorded, and announce a release that does not exist.
 */
export const APP_VERSION: string | null = Constants.expoConfig?.version ?? null;

/**
 * The build behind that version — iOS's `buildNumber`, Android's `versionCode`. Both are set by
 * EAS at build time (`autoIncrement`), so neither is in `app.json` for a local run to read and
 * both are legitimately absent in development.
 */
const APP_BUILD =
	Platform.OS === 'ios'
		? Constants.expoConfig?.ios?.buildNumber
		: Platform.OS === 'android'
		? Constants.expoConfig?.android?.versionCode
		: undefined;

/**
 * Which build this is, when it is **not** the one people install from the store.
 *
 * `Updates.channel` is the build's own channel — not the branch an update came from, which is
 * a different thing entirely and joined to it only by a mapping. Production is deliberately
 * silent: naming it would put a word on the one row where the absence of a word is the point.
 *
 * **`null` means development**, and that is the API's own definition rather than a guess:
 * Expo Go and development builds are not pinned to a channel, because they may run any update
 * their runtime accepts, so `channel` is null there however `eas.json` labels the profile.
 */
export const BUILD_CHANNEL: string | null =
	Updates.channel === null || Updates.channel === ''
		? 'development'
		: Updates.channel === 'production'
		? null
		: Updates.channel;

/**
 * "1.0.2 (4)", or "1.0.2" where there is no build number, or "—" where there is nothing —
 * with the channel appended on anything but production: "1.2.0 (4) · preview".
 */
export const appVersionLabel = (): string => {
	if (APP_VERSION === null) {
		return '—';
	}

	const version = APP_BUILD === undefined || APP_BUILD === null ? APP_VERSION : `${APP_VERSION} (${APP_BUILD})`;

	return BUILD_CHANNEL === null ? version : `${version} · ${BUILD_CHANNEL}`;
};
