import { describe, expect, it } from 'vitest';
import { coverageFor, portionForDay, spansFor, startsFor, PLAN_DAYS, PLAN_SPANS } from '@utils/hizbPlans';
import { hizbWorksOf } from '@utils/hizbWorks';

describe('personal Hizb rotations', () => {
	it('each starting position covers the whole plan exactly once and wraps', () => {
		for (const days of PLAN_DAYS) {
			for (let sequence = 0; sequence < days * 3; sequence++) {
				const portions = Array.from({ length: days }, (_, day) => portionForDay(days, sequence, day));
				expect(new Set(portions).size).toBe(days);
				expect(portionForDay(days, sequence, days)).toBe(portions[0]);
			}
		}
	});
	it('all plan divisions cover exactly the same canonical spans', () => {
		const totals = PLAN_DAYS.map(days => Array.from({ length: days }, (_, i) => spansFor(days, i + 1)).flat());
		expect(totals[0]).toEqual(totals[1]);
		expect(totals[1]).toEqual(totals[2]);
		expect(new Set(totals[0]).size).toBe(totals[0]!.length);
	});
	it('duplicates and mixed-plan overlaps cannot hide a missing passage', () => {
		const reads = Array.from({ length: 40 }, () => ({ planDays: 7, portion: 1 }));
		expect(coverageFor(reads).complete).toBe(false);
		expect(coverageFor(reads).covered).toBe(spansFor(7, 1).length);
		expect(coverageFor(Array.from({ length: 7 }, (_, i) => ({ planDays: 7, portion: i + 1 }))).complete).toBe(true);
	});
	it('follows the family calendar: 7, 15 and 32 days, the longest one portion a day', () => {
		expect(PLAN_DAYS).toEqual([7, 15, 32]);
		expect(startsFor(32)).toHaveLength(32);
		expect(() => startsFor(33)).toThrow(RangeError);
		expect(PLAN_SPANS).toHaveLength(32);
	});
});

describe('the Hizb works by portion', () => {
	it('names the work each of the 32 portions belongs to', () => {
		const at = (portion: number) => hizbWorksOf([portion], 'en');
		expect([at(1), at(3), at(4), at(8), at(9), at(13), at(14), at(18)]).toEqual([
			'Qur’an portion',
			'Qur’an portion',
			'Cevşenü’l-Kebîr',
			'Cevşenü’l-Kebîr',
			'Evrâd-ı Kudsiye',
			'Evrâd-ı Kudsiye',
			'Delâilü’n-Nûr',
			'Delâilü’n-Nûr'
		]);
		expect([at(19), at(20), at(21), at(24), at(25), at(26), at(29), at(30), at(32)]).toEqual([
			'Sekîne',
			'Münâcât & İsm-i Âzam',
			'Münâcâtü’l-Kur’ân',
			'Münâcâtü’l-Kur’ân',
			'Tahmîdiye',
			'Hulâsatü’l-Hulâsa',
			'Hulâsatü’l-Hulâsa',
			'Tazarru ve Niyaz',
			'Tazarru ve Niyaz'
		]);
		expect(at(33)).toBe('');
	});
});
