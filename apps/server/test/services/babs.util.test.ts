import {
	BAB_COUNT,
	babNumbersForRound,
	babNumbersForSlot,
	babsPerPerson,
	formatBabRange,
	progressPercent,
	rangeForRound,
	rangeForSlot,
	rotatedSlot,
	slotIndexForBab
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
			expect(rangeForRound(0, 20, 0, BAB_COUNT)).toEqual({ start: 1, end: 5 });
			expect(rangeForRound(0, 20, 1, BAB_COUNT)).toEqual({ start: 6, end: 10 });
			expect(rangeForRound(19, 20, 1, BAB_COUNT)).toEqual({ start: 1, end: 5 });
		});

		it.each([7, 12, 20, 30])('still tiles 1..100 exactly in round 3 with %i spots', spots => {
			const seen = new Set<number>();

			for (let slot = 0; slot < spots; slot++) {
				for (const number of babNumbersForRound(slot, spots, 3, BAB_COUNT)) {
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
				const range = rangeForRound(0, spots, round, BAB_COUNT);
				blocks.add(`${range?.start}-${range?.end}`);
			}

			expect(blocks.size).toBe(spots);
		});
	});

	describe('rangeForSlot', () => {
		it('splits 20 spots into even 5-bab blocks', () => {
			expect(rangeForSlot(0, 20, BAB_COUNT)).toEqual({ start: 1, end: 5 });
			expect(rangeForSlot(19, 20, BAB_COUNT)).toEqual({ start: 96, end: 100 });
		});

		it('gives the first 10 of 30 seats an extra bab', () => {
			expect(rangeForSlot(0, 30, BAB_COUNT)).toEqual({ start: 1, end: 4 });
			expect(rangeForSlot(9, 30, BAB_COUNT)).toEqual({ start: 37, end: 40 });
			expect(rangeForSlot(10, 30, BAB_COUNT)).toEqual({ start: 41, end: 43 });
			expect(rangeForSlot(29, 30, BAB_COUNT)).toEqual({ start: 98, end: 100 });
		});

		it('returns null for an out-of-range slot', () => {
			expect(rangeForSlot(-1, 20, BAB_COUNT)).toBeNull();
			expect(rangeForSlot(20, 20, BAB_COUNT)).toBeNull();
			expect(rangeForSlot(0, 0, BAB_COUNT)).toBeNull();
			expect(rangeForSlot(1.5, 20, BAB_COUNT)).toBeNull();
		});

		it.each([5, 7, 20, 25, 30, 50])('covers 1..%i with no gaps or overlaps for %i spots', spots => {
			const seen = new Set<number>();

			for (let slot = 0; slot < spots; slot++) {
				const range = rangeForSlot(slot, spots, BAB_COUNT);
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

	describe('a group of 33 parts', () => {
		const HIZB_PARTS = 33;

		it('gives each of 11 seats three parts, tiling 1..33', () => {
			const seats = Array.from({ length: 11 }, (_, slot) => rangeForSlot(slot, 11, HIZB_PARTS));

			expect(seats[0]).toEqual({ start: 1, end: 3 });
			expect(seats[10]).toEqual({ start: 31, end: 33 });
			expect(seats.every(range => range !== null && range.end - range.start + 1 === 3)).toBe(true);
			expect(seats.flatMap((_, slot) => babNumbersForSlot(slot, 11, HIZB_PARTS))).toEqual(
				Array.from({ length: HIZB_PARTS }, (_, index) => index + 1)
			);
		});

		it('gives the one leftover part to the first of 16 seats', () => {
			expect(rangeForSlot(0, 16, HIZB_PARTS)).toEqual({ start: 1, end: 3 });
			expect(rangeForSlot(1, 16, HIZB_PARTS)).toEqual({ start: 4, end: 5 });
			expect(rangeForSlot(15, 16, HIZB_PARTS)).toEqual({ start: 32, end: 33 });
		});

		it('gives each of 33 seats one part', () => {
			for (let slot = 0; slot < HIZB_PARTS; slot++) {
				expect(rangeForSlot(slot, HIZB_PARTS, HIZB_PARTS)).toEqual({ start: slot + 1, end: slot + 1 });
			}
		});

		it('gives a lone seat the whole 33', () => {
			expect(rangeForSlot(0, 1, HIZB_PARTS)).toEqual({ start: 1, end: 33 });
		});

		it('tiles 1..33 exactly for every seat count and every round', () => {
			for (let spots = 1; spots <= HIZB_PARTS; spots++) {
				for (let round = 0; round <= 40; round++) {
					const seen: number[] = [];

					for (let slot = 0; slot < spots; slot++) {
						seen.push(...babNumbersForRound(slot, spots, round, HIZB_PARTS));
					}

					expect(seen.sort((a, b) => a - b)).toEqual(
						Array.from({ length: HIZB_PARTS }, (_, index) => index + 1)
					);
				}
			}
		});

		it('finds the seat of the last part, and none past it', () => {
			expect(slotIndexForBab(33, 11, HIZB_PARTS)).toBe(10);
			expect(slotIndexForBab(34, 11, HIZB_PARTS)).toBeNull();
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
			expect(babsPerPerson(20, BAB_COUNT)).toBe(5);
			expect(babsPerPerson(30, BAB_COUNT)).toBe(3);
		});

		it('returns 0 for non-positive spots', () => {
			expect(babsPerPerson(0, BAB_COUNT)).toBe(0);
			expect(babsPerPerson(-5, BAB_COUNT)).toBe(0);
		});
	});

	describe('progressPercent', () => {
		it('computes a rounded percentage', () => {
			expect(progressPercent(50, BAB_COUNT)).toBe(50);
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
