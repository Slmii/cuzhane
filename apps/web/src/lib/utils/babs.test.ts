import { describe, expect, it } from 'vitest';
import { BAB_COUNT, babNumbersForSlot, babsPerPerson, formatBabRange, progressPercent, rangeForSlot } from './babs';

describe('rangeForSlot', () => {
	it('splits 100 into equal blocks when spots divides evenly', () => {
		expect(rangeForSlot(0, 20)).toEqual({ start: 1, end: 5 });
		expect(rangeForSlot(1, 20)).toEqual({ start: 6, end: 10 });
		expect(rangeForSlot(19, 20)).toEqual({ start: 96, end: 100 });
	});

	it('gives the leading seats the extra bab when spots does not divide evenly', () => {
		// 100 / 30 -> 10 seats of 4, then 20 seats of 3.
		expect(rangeForSlot(0, 30)).toEqual({ start: 1, end: 4 });
		expect(rangeForSlot(9, 30)).toEqual({ start: 37, end: 40 });
		expect(rangeForSlot(10, 30)).toEqual({ start: 41, end: 43 });
		expect(rangeForSlot(29, 30)).toEqual({ start: 98, end: 100 });
	});

	it('returns null for seats outside the group', () => {
		expect(rangeForSlot(-1, 20)).toBeNull();
		expect(rangeForSlot(20, 20)).toBeNull();
		expect(rangeForSlot(1.5, 20)).toBeNull();
		expect(rangeForSlot(0, 0)).toBeNull();
	});

	it.each([5, 7, 20, 25, 30, 50])('covers 1..100 exactly once with %i spots', spots => {
		const seen: number[] = [];

		for (let slotIndex = 0; slotIndex < spots; slotIndex += 1) {
			seen.push(...babNumbersForSlot(slotIndex, spots));
		}

		expect(seen).toHaveLength(BAB_COUNT);
		expect(new Set(seen).size).toBe(BAB_COUNT);
		expect(Math.min(...seen)).toBe(1);
		expect(Math.max(...seen)).toBe(BAB_COUNT);
	});
});

describe('formatBabRange', () => {
	it('collapses a contiguous run', () => {
		expect(formatBabRange([1, 2, 3, 4, 5])).toBe('1–5');
	});

	it('splits non-contiguous runs', () => {
		expect(formatBabRange([1, 2, 3, 12])).toBe('1–3, 12');
	});

	it('renders a lone bab without a dash', () => {
		expect(formatBabRange([7])).toBe('7');
	});

	it('sorts before collapsing', () => {
		expect(formatBabRange([3, 1, 2])).toBe('1–3');
	});

	it('renders an em dash when nothing is held', () => {
		expect(formatBabRange([])).toBe('—');
	});
});

describe('babsPerPerson', () => {
	it('rounds to the nearest whole bab', () => {
		expect(babsPerPerson(20)).toBe(5);
		expect(babsPerPerson(30)).toBe(3);
	});

	it('returns 0 rather than dividing by zero', () => {
		expect(babsPerPerson(0)).toBe(0);
	});
});

describe('progressPercent', () => {
	it('reports whole percentages', () => {
		expect(progressPercent(78)).toBe(78);
		expect(progressPercent(1, 3)).toBe(33);
	});

	it('clamps out-of-range input', () => {
		expect(progressPercent(-5)).toBe(0);
		expect(progressPercent(500)).toBe(100);
		expect(progressPercent(5, 0)).toBe(0);
	});
});
