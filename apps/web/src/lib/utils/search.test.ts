import { describe, expect, it } from 'vitest';
import { findMatch, highlightMatch, normalizeSearch, searchCevsen, searchGroups } from './search';

describe('normalizeSearch', () => {
	it('folds Turkish dotted/dotless I correctly before lowercasing', () => {
		expect(normalizeSearch('İSTANBUL')).toBe('istanbul');
		expect(normalizeSearch('ISPARTA')).toBe('ısparta');
	});

	it('strips Arabic harakat marks', () => {
		expect(normalizeSearch('رَحْمَة')).toBe('رحمة');
	});

	it('collapses runs of whitespace to a single space', () => {
		expect(normalizeSearch('  hello   world  ')).toBe('hello world');
	});
});

describe('findMatch', () => {
	it('returns original-index ranges for a Turkish string with İ/ı', () => {
		const text = 'İstanbul Hatmi';
		const match = findMatch(text, 'istan');

		expect(match).not.toBeNull();
		expect(text.slice(match!.start, match!.end).toLocaleLowerCase('tr-TR')).toBe(
			normalizeSearch(text.slice(match!.start, match!.end))
		);
		expect(normalizeSearch(text.slice(match!.start, match!.end))).toBe('istan');
	});

	it('returns original-index ranges for an Arabic string with harakat', () => {
		const text = 'رَحْمَة';
		const match = findMatch(text, 'رحمة');

		expect(match).not.toBeNull();
		expect(text.slice(match!.start, match!.end)).toBe(text);
	});

	it('returns null for an empty or whitespace-only query', () => {
		expect(findMatch('hello', '')).toBeNull();
		expect(findMatch('hello', '   ')).toBeNull();
	});

	it('returns null when there is no match', () => {
		expect(findMatch('hello world', 'zzz')).toBeNull();
	});
});

describe('highlightMatch', () => {
	it('recombines pre/mid/post to the original text on a match', () => {
		const text = 'Şifa Hatmi Grubu';
		const parts = highlightMatch(text, 'hatmi');

		expect(parts.pre + parts.mid + parts.post).toBe(text);
		expect(parts.mid.toLocaleLowerCase('tr-TR')).toBe('hatmi');
	});

	it('puts everything in pre when there is no match', () => {
		const text = 'Şifa Hatmi Grubu';
		const parts = highlightMatch(text, 'zzz');

		expect(parts).toEqual({ pre: text, mid: '', post: '' });
	});
});

describe('searchCevsen — bab number hits', () => {
	it('matches an exact bab number', () => {
		const result = searchCevsen('41');

		expect(result.babs).toEqual([{ babNumber: 41 }]);
	});

	it('does not match a prefix of a bab number ("4" is not bab 40-49)', () => {
		const result = searchCevsen('4');

		expect(result.babs).toEqual([{ babNumber: 4 }]);
	});

	it('produces no bab hits for a non-numeric query', () => {
		const result = searchCevsen('rahmet');

		expect(result.babs).toEqual([]);
	});

	it('produces no bab hits for an out-of-range number', () => {
		expect(searchCevsen('0').babs).toEqual([]);
		expect(searchCevsen('101').babs).toEqual([]);
	});
});

describe('searchCevsen — text hits', () => {
	it('returns matching text hits with source "tr" and a matching line', () => {
		const result = searchCevsen('rahmet');

		expect(result.text.length).toBeGreaterThan(0);

		for (const hit of result.text) {
			expect(hit.source === 'tr' || hit.source === 'text').toBe(true);
			expect(findMatch(hit.line, 'rahmet')).not.toBeNull();
		}

		expect(result.text.some(hit => hit.source === 'tr')).toBe(true);
	});

	it('returns no text hits for queries shorter than 2 normalized characters', () => {
		expect(searchCevsen('x').text).toEqual([]);
		expect(searchCevsen('').text).toEqual([]);
	});

	it('respects the maxText option', () => {
		const result = searchCevsen('a', { maxText: 3 });

		expect(result.text.length).toBeLessThanOrEqual(3);
	});
});

describe('searchGroups', () => {
	type TestGroup = { id: string; name: string };

	const groups: TestGroup[] = [
		{ id: '1', name: 'Şifa Hatmi' },
		{ id: '2', name: 'Seher Hatmi' }
	];

	it('matches case-insensitively and Turkish-insensitively', () => {
		expect(searchGroups(groups, 'şifa').map(g => g.id)).toEqual(['1']);
		expect(searchGroups(groups, 'SIFA').map(g => g.id)).toEqual([]);
		expect(searchGroups(groups, 'şıfa').map(g => g.id)).toEqual([]);
		expect(searchGroups(groups, 'hatmi').map(g => g.id)).toEqual(['1', '2']);
	});

	it('returns an empty array for an empty query', () => {
		expect(searchGroups(groups, '')).toEqual([]);
		expect(searchGroups(groups, '  ')).toEqual([]);
	});

	it('returns an empty array when groups is undefined', () => {
		expect(searchGroups(undefined, 'hatmi')).toEqual([]);
	});

	it('matches a multi-word query across a space in the name', () => {
		expect(searchGroups(groups, 'şifa hatmi').map(g => g.id)).toEqual(['1']);
		expect(searchGroups(groups, 'Şifa   Hatmi').map(g => g.id)).toEqual(['1']);
	});
});

describe('findMatch — whitespace and marks', () => {
	it('keeps spaces in the haystack so phrases match and highlight', () => {
		const text = 'Ey kalpleri  şifa ile onaran';
		const match = findMatch(text, 'şifa ile');

		expect(match).not.toBeNull();
		expect(text.slice(match!.start, match!.end)).toBe('şifa ile');
	});

	it('extends the range over a mark that follows the last matched letter', () => {
		const text = 'رَحْمَةٌ';
		const match = findMatch(text, 'رحمة');

		expect(match).toEqual({ start: 0, end: text.length });
	});
});

describe('searchCevsen — closings', () => {
	it('tells a closing apart from the invocation that shares its number', () => {
		const { text } = searchCevsen('يا', { maxText: 400 });
		const keys = text.map(hit => `${hit.babNumber}-${hit.part}-${hit.invocationNumber}-${hit.source}`);

		expect(text.some(hit => hit.part === 'closing')).toBe(true);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
