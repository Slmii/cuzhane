import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES, interpolate, isAppLanguage, STRINGS } from './strings';

describe('STRINGS', () => {
	it('defines the same keys in every language', () => {
		const trKeys = Object.keys(STRINGS.tr).sort();
		const enKeys = Object.keys(STRINGS.en).sort();

		expect(enKeys).toEqual(trKeys);
	});

	it('has no blank values', () => {
		for (const language of APP_LANGUAGES) {
			for (const [key, value] of Object.entries(STRINGS[language])) {
				expect(value, `${language}.${key} is blank`).not.toBe('');
			}
		}
	});

	it('uses the same placeholders in both languages', () => {
		const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();

		for (const key of Object.keys(STRINGS.tr) as (keyof typeof STRINGS.tr)[]) {
			expect(placeholders(STRINGS.en[key]), `mismatch on "${key}"`).toEqual(placeholders(STRINGS.tr[key]));
		}
	});
});

describe('interpolate', () => {
	it('substitutes named tokens', () => {
		expect(interpolate('Salaam, {name}', { name: 'Ayşe' })).toBe('Salaam, Ayşe');
	});

	it('substitutes numbers', () => {
		expect(interpolate('{count} spots left', { count: 2 })).toBe('2 spots left');
	});

	it('replaces every occurrence', () => {
		expect(interpolate('{a} and {a}', { a: 'x' })).toBe('x and x');
	});

	it('leaves unknown tokens in place so they are visible in QA', () => {
		expect(interpolate('Hello {missing}', { name: 'Ayşe' })).toBe('Hello {missing}');
	});

	it('returns the template untouched when no values are given', () => {
		expect(interpolate('Hello {name}')).toBe('Hello {name}');
	});
});

describe('isAppLanguage', () => {
	it('accepts supported languages', () => {
		expect(isAppLanguage('tr')).toBe(true);
		expect(isAppLanguage('en')).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isAppLanguage('de')).toBe(false);
		expect(isAppLanguage(null)).toBe(false);
		expect(isAppLanguage(undefined)).toBe(false);
	});
});
