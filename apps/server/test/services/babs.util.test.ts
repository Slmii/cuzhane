import {
	BAB_COUNT,
	babNumbersForRound,
	babsPerPerson,
	formatBabRange,
	progressPercent,
	rangeForRound,
	rangeForSlot,
	rotatedSlot
} from '@utils/babs';
import { describe, expect, it } from 'vitest';

describe('babs util', () => {
	describe('rotatedSlot', () => {
		it('advances one seat per round and wraps', () => {
			expect(rotatedSlot(0, 20, 0)).toBe(0);
			expect(rotatedSlot(0, 20, 1)).toBe(1);
			expect(rotatedSlot(19, 20, 1)).toBe(0);
			expect(rotatedSlot(0, 20, 20)).toBe(0);
			expect(rotatedSlot(3, 20, 47)).toBe(10);
		});

		it('rejects an out-of-range seat the same way rangeForSlot does', () => {
			expect(rotatedSlot(-1, 20, 0)).toBeNull();
			expect(rotatedSlot(20, 20, 0)).toBeNull();
			expect(rotatedSlot(0, 0, 0)).toBeNull();
		});
	});

	describe('rangeForRound', () => {
		it("hands a seat the next seat's block in the next round", () => {
			expect(rangeForRound(0, 20, 0)).toEqual({ start: 1, end: 5 });
			expect(rangeForRound(0, 20, 1)).toEqual({ start: 6, end: 10 });
			expect(rangeForRound(19, 20, 1)).toEqual({ start: 1, end: 5 });
		});

		it.each([7, 12, 20, 30])('still tiles 1..100 exactly in round 3 with %i spots', spots => {
			const seen = new Set<number>();

			for (let slot = 0; slot < spots; slot++) {
				for (const number of babNumbersForRound(slot, spots, 3)) {
					expect(seen.has(number)).toBe(false);
					seen.add(number);
				}
			}

			expect(seen.size).toBe(BAB_COUNT);
		});

		it('gives every seat a turn at every block over a full cycle of rounds', () => {
			const spots = 12;
			const blocks = new Set<string>();

			for (let round = 0; round < spots; round++) {
				const range = rangeForRound(0, spots, round);
				blocks.add(`${range?.start}-${range?.end}`);
			}

			expect(blocks.size).toBe(spots);
		});
	});

	describe('rangeForSlot', () => {
		it('splits 20 spots into even 5-bab blocks', () => {
			expect(rangeForSlot(0, 20)).toEqual({ start: 1, end: 5 });
			expect(rangeForSlot(19, 20)).toEqual({ start: 96, end: 100 });
		});

		it('gives the first 10 of 30 seats an extra bab', () => {
			expect(rangeForSlot(0, 30)).toEqual({ start: 1, end: 4 });
			expect(rangeForSlot(9, 30)).toEqual({ start: 37, end: 40 });
			expect(rangeForSlot(10, 30)).toEqual({ start: 41, end: 43 });
			expect(rangeForSlot(29, 30)).toEqual({ start: 98, end: 100 });
		});

		it('returns null for an out-of-range slot', () => {
			expect(rangeForSlot(-1, 20)).toBeNull();
			expect(rangeForSlot(20, 20)).toBeNull();
			expect(rangeForSlot(0, 0)).toBeNull();
			expect(rangeForSlot(1.5, 20)).toBeNull();
		});

		it.each([5, 7, 20, 25, 30, 50])('covers 1..%i with no gaps or overlaps for %i spots', spots => {
			const seen = new Set<number>();

			for (let slot = 0; slot < spots; slot++) {
				const range = rangeForSlot(slot, spots);
				expect(range).not.toBeNull();

				for (let n = range!.start; n <= range!.end; n++) {
					expect(seen.has(n)).toBe(false);
					seen.add(n);
				}
			}

			expect(seen.size).toBe(BAB_COUNT);
			expect(Math.min(...seen)).toBe(1);
			expect(Math.max(...seen)).toBe(BAB_COUNT);
		});
	});

	describe('formatBabRange', () => {
		it('formats a contiguous range', () => {
			expect(formatBabRange([1, 2, 3, 4, 5])).toBe('1–5');
		});

		it('formats a range with a gap', () => {
			expect(formatBabRange([1, 2, 3, 12])).toBe('1–3, 12');
		});

		it('formats an empty list', () => {
			expect(formatBabRange([])).toBe('—');
		});

		it('formats a single number', () => {
			expect(formatBabRange([7])).toBe('7');
		});
	});

	describe('babsPerPerson', () => {
		it('rounds babs per person', () => {
			expect(babsPerPerson(20)).toBe(5);
			expect(babsPerPerson(30)).toBe(3);
		});

		it('returns 0 for non-positive spots', () => {
			expect(babsPerPerson(0)).toBe(0);
			expect(babsPerPerson(-5)).toBe(0);
		});
	});

	describe('progressPercent', () => {
		it('computes a rounded percentage', () => {
			expect(progressPercent(50)).toBe(50);
			expect(progressPercent(1, 3)).toBe(33);
		});

		it('returns 0 when total is 0', () => {
			expect(progressPercent(0, 0)).toBe(0);
			expect(progressPercent(5, 0)).toBe(0);
		});

		it('clamps to 100 when read exceeds total', () => {
			expect(progressPercent(150, 100)).toBe(100);
		});

		it('never goes below 0', () => {
			expect(progressPercent(-10, 100)).toBe(0);
		});
	});
});
