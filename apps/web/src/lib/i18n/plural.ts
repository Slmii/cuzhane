import type { AppLanguage, StringKey } from '@/lib/i18n/strings';

/**
 * Which of a count's two strings to use — "1 day" or "12 days". Two forms is all TR, EN and NL
 * need, and for whole numbers all three pick "one" for exactly 1; Turkish gives both the same text.
 *
 * **Not `Intl.PluralRules`.** Hermes does not ship it, so on a device the constructor is
 * `undefined` and Ana sayfa crashed on render — while the tests, on Node, passed. The rule below
 * is those three languages' own; a language that needs more forms needs more than this helper.
 */
export const pluralKey = (_language: AppLanguage, count: number, one: StringKey, other: StringKey): StringKey =>
	count === 1 ? one : other;
