import { describe, expect, it } from 'vitest';
import {
	BAB_COUNT,
	babNumbersForRound,
	babNumbersForSlot,
	babsPerPerson,
	formatBabRange,
	progressPercent,
	rangeForSlot,
	slotIndexForBab
} from './babs';

describe('rangeForSlot', () => {
	it('splits 100 into equal blocks when spots divides evenly', () => {
		expect(rangeForSlot(0, 20, BAB_COUNT)).toEqual({ start: 1, end: 5 });
		expect(rangeForSlot(1, 20, BAB_COUNT)).toEqual({ start: 6, end: 10 });
		expect(rangeForSlot(19, 20, BAB_COUNT)).toEqual({ start: 96, end: 100 });
	});

	it('gives the leading seats the extra bab when spots does not divide evenly', () => {
		// 100 / 30 -> 10 seats of 4, then 20 seats of 3.
		expect(rangeForSlot(0, 30, BAB_COUNT)).toEqual({ start: 1, end: 4 });
		expect(rangeForSlot(9, 30, BAB_COUNT)).toEqual({ start: 37, end: 40 });
		expect(rangeForSlot(10, 30, BAB_COUNT)).toEqual({ start: 41, end: 43 });
		expect(rangeForSlot(29, 30, BAB_COUNT)).toEqual({ start: 98, end: 100 });
	});

	it('returns null for seats outside the group', () => {
		expect(rangeForSlot(-1, 20, BAB_COUNT)).toBeNull();
		expect(rangeForSlot(20, 20, BAB_COUNT)).toBeNull();
		expect(rangeForSlot(1.5, 20, BAB_COUNT)).toBeNull();
		expect(rangeForSlot(0, 0, BAB_COUNT)).toBeNull();
	});

	it.each([5, 7, 20, 25, 30, 50])('covers 1..100 exactly once with %i spots', spots => {
		const seen: number[] = [];

		for (let slotIndex = 0; slotIndex < spots; slotIndex += 1) {
			seen.push(...babNumbersForSlot(slotIndex, spots, BAB_COUNT));
		}

		expect(seen).toHaveLength(BAB_COUNT);
		expect(new Set(seen).size).toBe(BAB_COUNT);
		expect(Math.min(...seen)).toBe(1);
		expect(Math.max(...seen)).toBe(BAB_COUNT);
	});
});

describe('a group of 33 parts', () => {
	const HIZB_PARTS = 33;
	const ALL_PARTS = Array.from({ length: HIZB_PARTS }, (_, index) => index + 1);

	it('gives each of 11 seats three parts, tiling 1..33', () => {
		const seen: number[] = [];

		for (let slotIndex = 0; slotIndex < 11; slotIndex += 1) {
			const numbers = babNumbersForSlot(slotIndex, 11, HIZB_PARTS);

			expect(numbers).toHaveLength(3);
			seen.push(...numbers);
		}

		expect(seen).toEqual(ALL_PARTS);
	});

	it('gives the one leftover part to the first of 16 seats', () => {
		expect(rangeForSlot(0, 16, HIZB_PARTS)).toEqual({ start: 1, end: 3 });
		expect(rangeForSlot(1, 16, HIZB_PARTS)).toEqual({ start: 4, end: 5 });
		expect(rangeForSlot(15, 16, HIZB_PARTS)).toEqual({ start: 32, end: 33 });
	});

	it('gives each of 33 seats one part, and a lone seat all 33', () => {
		for (let slotIndex = 0; slotIndex < HIZB_PARTS; slotIndex += 1) {
			expect(rangeForSlot(slotIndex, HIZB_PARTS, HIZB_PARTS)).toEqual({
				start: slotIndex + 1,
				end: slotIndex + 1
			});
		}

		expect(rangeForSlot(0, 1, HIZB_PARTS)).toEqual({ start: 1, end: 33 });
	});

	it('tiles 1..33 exactly for every seat count and every round', () => {
		for (let spots = 1; spots <= HIZB_PARTS; spots += 1) {
			for (let round = 0; round <= 40; round += 1) {
				const seen: number[] = [];

				for (let slotIndex = 0; slotIndex < spots; slotIndex += 1) {
					seen.push(...babNumbersForRound(slotIndex, spots, round, HIZB_PARTS));
				}

				expect(seen.sort((a, b) => a - b)).toEqual(ALL_PARTS);
			}
		}
	});

	it('finds the seat of the last part, and none past it', () => {
		expect(slotIndexForBab(33, 11, HIZB_PARTS)).toBe(10);
		expect(slotIndexForBab(34, 11, HIZB_PARTS)).toBeNull();
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
		expect(babsPerPerson(20, BAB_COUNT)).toBe(5);
		expect(babsPerPerson(30, BAB_COUNT)).toBe(3);
	});

	it('returns 0 rather than dividing by zero', () => {
		expect(babsPerPerson(0, BAB_COUNT)).toBe(0);
	});
});

describe('progressPercent', () => {
	it('reports whole percentages', () => {
		expect(progressPercent(78, BAB_COUNT)).toBe(78);
		expect(progressPercent(1, 3)).toBe(33);
	});

	it('clamps out-of-range input', () => {
		expect(progressPercent(-5, BAB_COUNT)).toBe(0);
		expect(progressPercent(500, BAB_COUNT)).toBe(100);
		expect(progressPercent(5, 0)).toBe(0);
	});
});
