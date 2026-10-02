import { describe, expect, it } from 'vitest';
import {
	bookmarkToCuzPlace,
	cuzPlaceToBookmark,
	isPersonalPlanGroup,
	planDayValues,
	planReadingRoute,
	planSplit,
	planUnitsOf
} from './personalPlan';

describe('planUnitsOf', () => {
	it('gives the Cevşen ten babs a day over ten days, in order', () => {
		expect(planUnitsOf('CEVSEN', 10, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(planUnitsOf('CEVSEN', 10, 5)).toEqual([41, 42, 43, 44, 45, 46, 47, 48, 49, 50]);
		expect(planUnitsOf('CEVSEN', 10, 10)).toEqual([91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
	});

	it('puts the extra babs on the first days when a length does not divide the hundred', () => {
		// 100 over 15: ten days of 7, five of 6.
		expect(planUnitsOf('CEVSEN', 15, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(planUnitsOf('CEVSEN', 15, 10)).toEqual([64, 65, 66, 67, 68, 69, 70]);
		expect(planUnitsOf('CEVSEN', 15, 11)).toEqual([71, 72, 73, 74, 75, 76]);
		expect(planUnitsOf('CEVSEN', 15, 15)).toEqual([95, 96, 97, 98, 99, 100]);
	});

	it('covers every bab and cüz exactly once over a plan', () => {
		for (const [kind, days, total] of [
			['CEVSEN', 90, 100],
			['CEVSEN', 7, 100],
			['HATIM', 30, 30],
			['HATIM', 7, 30],
			['HATIM', 1, 30]
		] as const) {
			const units = Array.from({ length: days }, (_, index) => planUnitsOf(kind, days, index + 1)).flat();

			expect(units).toEqual(Array.from({ length: total }, (_, index) => index + 1));
		}
	});

	it('gives the Kur’an a cüz a day over thirty days and two over fifteen', () => {
		expect(planUnitsOf('HATIM', 30, 7)).toEqual([7]);
		expect(planUnitsOf('HATIM', 15, 2)).toEqual([3, 4]);
	});

	it('has nothing for a day outside the plan', () => {
		expect(planUnitsOf('HATIM', 10, 0)).toEqual([]);
		expect(planUnitsOf('HATIM', 10, 11)).toEqual([]);
	});
});

describe('planSplit', () => {
	it('says an even split once', () => {
		expect(planSplit('CEVSEN', 10)).toEqual({ lastDays: 0, lastPerDay: 10, perDay: 10 });
		expect(planSplit('HATIM', 15)).toEqual({ lastDays: 0, lastPerDay: 2, perDay: 2 });
		expect(planSplit('HATIM', 30)).toEqual({ lastDays: 0, lastPerDay: 1, perDay: 1 });
	});

	it('names the shorter last days of an uneven split', () => {
		expect(planSplit('CEVSEN', 15)).toEqual({ lastDays: 5, lastPerDay: 6, perDay: 7 });
		expect(planSplit('CEVSEN', 90)).toEqual({ lastDays: 80, lastPerDay: 1, perDay: 2 });
		expect(planSplit('HATIM', 20)).toEqual({ lastDays: 10, lastPerDay: 1, perDay: 2 });
	});

	it('agrees with the days themselves', () => {
		for (const days of [7, 13, 30, 45, 90]) {
			const split = planSplit('CEVSEN', days);

			expect(planUnitsOf('CEVSEN', days, 1)).toHaveLength(split.perDay);
			expect(planUnitsOf('CEVSEN', days, days)).toHaveLength(
				split.lastDays > 0 ? split.lastPerDay : split.perDay
			);
		}
	});
});

describe('planDayValues', () => {
	it('walks the Cevşen from one to ninety days and the Kur’an from one to thirty', () => {
		expect(planDayValues('CEVSEN')).toHaveLength(90);
		expect(planDayValues('CEVSEN')[0]).toBe(1);
		expect(planDayValues('HATIM').at(-1)).toBe(30);
	});
});

describe('isPersonalPlanGroup', () => {
	it('is a Hizb plan or a Şahsi reading, and nothing from a server that sends neither', () => {
		expect(isPersonalPlanGroup({ hizbPlan: 7, planDays: null })).toBe(true);
		expect(isPersonalPlanGroup({ hizbPlan: 0 })).toBe(true);
		expect(isPersonalPlanGroup({ hizbPlan: null, planDays: 15 })).toBe(true);
		expect(isPersonalPlanGroup({ hizbPlan: null, planDays: null })).toBe(false);
		expect(isPersonalPlanGroup({})).toBe(false);
	});
});

describe('planReadingRoute', () => {
	it('opens each kind’s own reading', () => {
		expect(planReadingRoute('HIZB')).toBe('HizbPlanReader');
		expect(planReadingRoute('CEVSEN')).toBe('CevsenPlanReader');
		expect(planReadingRoute('HATIM')).toBe('CuzReader');
	});
});

describe("a Kur'an day's place", () => {
	it('round-trips the cüz in the day and the page in it', () => {
		for (const [cuzIndex, page] of [
			[0, 1],
			[0, 25],
			[1, 5],
			[29, 23]
		] as const) {
			expect(bookmarkToCuzPlace(cuzPlaceToBookmark(cuzIndex, page))).toEqual({ cuzIndex, page });
		}
	});

	it("fits a thirty-cüz day under the server's cap, and reads 0 as no place", () => {
		expect(cuzPlaceToBookmark(29, 25)).toBeLessThanOrEqual(1000);
		expect(bookmarkToCuzPlace(0)).toBeNull();
	});
});
