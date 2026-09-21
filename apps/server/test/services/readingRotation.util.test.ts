import { describe, expect, it } from 'vitest';
import { assignedPart, chooseStartingPart, cycleBoundary, stepAt } from '@utils/readingRotation';

describe('stable reading rotation', () => {
	it.each([
		[1, 1],
		[7, 7],
		[7, 3],
		[7, 10],
		[10, 4],
		[10, 20]
	])('%i parts / %i members', (parts, members) => {
		const offsets: number[] = [];
		for (let member = 0; member < members; member++) {
			offsets.push(chooseStartingPart(parts, offsets));
		}
		const counts = Array.from({ length: parts }, (_, part) => offsets.filter(p => p === part).length);
		expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
		for (const offset of offsets) {
			const traversal = Array.from({ length: parts }, (_, step) => assignedPart(offset, step, parts));
			expect(new Set(traversal).size).toBe(parts);
			expect(assignedPart(offset, parts, parts)).toBe(offset);
		}
	});
	it('spaces sparse members deterministically and fills a departed gap', () => {
		expect(chooseStartingPart(10, [0])).toBe(5);
		expect(chooseStartingPart(10, [0, 5])).toBe(2);
		expect(chooseStartingPart(7, [0, 1, 2, 4, 5, 6])).toBe(3);
	});
	it('normalizes a mid-cycle offset', () => {
		const offset = assignedPart(0, -4, 7);
		expect(assignedPart(offset, 4, 7)).toBe(0);
	});
	it('proves traversal for arbitrary part counts and offsets', () => {
		for (let p = 1; p <= 100; p++) {
			for (let o = 0; o < p; o++) {
				expect(new Set(Array.from({ length: p }, (_, s) => assignedPart(o, s, p))).size).toBe(p);
			}
		}
	});
	it('rejects invalid part counts', () => {
		for (const p of [0, -1, 1.5, NaN]) {
			expect(() => assignedPart(0, 0, p)).toThrow();
		}
	});
	it('uses calendar months and preserves the original anchor after February', () => {
		const start = new Date('2026-01-31T12:00:00Z');
		expect(cycleBoundary(start, 'MONTHLY', 1, 'UTC').toISOString()).toBe('2026-02-28T12:00:00.000Z');
		expect(cycleBoundary(start, 'MONTHLY', 2, 'UTC').toISOString()).toBe('2026-03-31T12:00:00.000Z');
	});
	it('keeps weekly wall time through DST and steps independent of P', () => {
		const start = new Date('2026-03-23T11:00:00Z');
		const end = cycleBoundary(start, 'WEEKLY', 1, 'Europe/Amsterdam');
		expect(end.toISOString()).toBe('2026-03-30T10:00:00.000Z');
		expect(stepAt(start, 'WEEKLY', 17, 'Europe/Amsterdam', end)).toBe(17);
		expect(stepAt(start, 'WEEKLY', 1, 'Europe/Amsterdam', start)).toBe(0);
	});
});
