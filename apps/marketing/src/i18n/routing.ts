import { LOCALES, type Locale } from './copy';

/**
 * **English sits at the root**; Turkish and Dutch are prefixed. This must match
 * `astro.config.mjs`'s `defaultLocale` and the `src/pages` tree, and every URL the site emits
 * goes through here, so the rule lives in one place rather than in each `href`.
 *
 * Note this is the *site's* default, not the app's — the app opens in Turkish.
 */
export const DEFAULT_LOCALE: Locale = 'en';

export const pathFor = (locale: Locale, path = ''): string => {
	const suffix = path === '' ? '' : `${path}/`;

	return locale === DEFAULT_LOCALE ? `/${suffix}` : `/${locale}/${suffix}`;
};

/** The other two languages, for the picker and for `hreflang`. */
export const otherLocales = (locale: Locale): Locale[] => LOCALES.filter(candidate => candidate !== locale);
