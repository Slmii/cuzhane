import { hasDelailRepetition, hasIstighfar, hasSekine, PLAN_DAYS } from '@utils/hizbPlans';
import { describe, expect, it } from 'vitest';

/** Which portions of a plan carry a gate. */
const portionsWith = (gate: (days: number, portion: number) => boolean, days: number) =>
	Array.from({ length: days }, (_, index) => index + 1).filter(portion => gate(days, portion));

/**
 * **Where the repetition gates fall, pinned.** A plan's divisions are version 1 and immutable —
 * persisted assignments keep them — so a gate that moved to another portion would silently lock
 * or unlock marking a day read for every reader on that plan.
 */
describe('the repetition gates of the personal plans', () => {
	it('put the opening istighfar on day 1 of every plan', () => {
		for (const days of PLAN_DAYS) {
			expect(portionsWith(hasIstighfar, days)).toEqual([1]);
		}
	});

	it('put Sekine ×19 on one day per plan', () => {
		expect(portionsWith(hasSekine, 7)).toEqual([4]);
		expect(portionsWith(hasSekine, 15)).toEqual([8]);
		expect(portionsWith(hasSekine, 33)).toEqual([19]);
	});

	it('put the Delail salawat ×3 on one day per plan', () => {
		expect(portionsWith(hasDelailRepetition, 7)).toEqual([4]);
		expect(portionsWith(hasDelailRepetition, 15)).toEqual([6]);
		expect(portionsWith(hasDelailRepetition, 33)).toEqual([14]);
	});

	it('refuse a plan or a portion that does not exist', () => {
		for (const gate of [hasIstighfar, hasSekine, hasDelailRepetition]) {
			expect(() => gate(10, 1)).toThrow(RangeError);
			expect(() => gate(7, 0)).toThrow(RangeError);
			expect(() => gate(7, 8)).toThrow(RangeError);
		}
	});
});
