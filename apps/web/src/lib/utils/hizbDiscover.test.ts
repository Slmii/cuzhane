import { describe, expect, it } from 'vitest';
import { compactCount, hizbAgeLabel } from './hizbDiscover';

const t = (key: string, values?: Record<string, string | number>) =>
	`${key}(${Object.entries(values ?? {})
		.map(([name, value]) => `${name}=${value}`)
		.join(',')})`;

describe('hizbAgeLabel', () => {
	it('says a group begun today started today, rather than "1. gün"', () => {
		expect(hizbAgeLabel(1, t)).toEqual({ isNew: true, label: 'hdStartedToday()' });
	});

	it('counts days up to a year, then whole years', () => {
		expect(hizbAgeLabel(41, t)).toEqual({ isNew: false, label: 'hdDayN(n=41)' });
		expect(hizbAgeLabel(365, t).label).toBe('hdDayN(n=365)');
		expect(hizbAgeLabel(366, t).label).toBe('hdYears(n=1)');
		expect(hizbAgeLabel(800, t).label).toBe('hdYears(n=2)');
	});
});

describe('compactCount', () => {
	it('keeps counts under a thousand whole, and shortens larger ones the language’s way', () => {
		expect(compactCount(148, 'tr')).toBe('148');
		expect(compactCount(1200, 'tr')).toBe('1,2 B');
		expect(compactCount(1200, 'en')).toBe('1.2K');
	});
});
