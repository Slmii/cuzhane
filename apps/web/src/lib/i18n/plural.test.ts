import { describe, expect, it } from 'vitest';
import { pluralKey } from './plural';

describe('pluralKey', () => {
	it('picks one for a single item and other for the rest', () => {
		expect(pluralKey('en', 1, 'countDaysOne', 'countDaysOther')).toBe('countDaysOne');
		expect(pluralKey('en', 12, 'countDaysOne', 'countDaysOther')).toBe('countDaysOther');
		expect(pluralKey('nl', 0, 'countDaysOne', 'countDaysOther')).toBe('countDaysOther');
	});
});
