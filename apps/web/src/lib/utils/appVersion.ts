import Constants from 'expo-constants';
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

/** "1.0.2 (4)", or "1.0.2" where there is no build number, or "—" where there is nothing. */
export const appVersionLabel = (): string => {
	if (APP_VERSION === null) {
		return '—';
	}

	return APP_BUILD === undefined || APP_BUILD === null ? APP_VERSION : `${APP_VERSION} (${APP_BUILD})`;
};
