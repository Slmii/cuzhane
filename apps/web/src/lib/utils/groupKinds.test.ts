import { describe, expect, it } from 'vitest';
import {
	CREATE_DEFAULTS_FOR_KIND,
	CYCLES_FOR_KIND,
	isPersonalPlan,
	PART_COUNT,
	PERSONAL_PLAN_MAX_DAYS,
	partCountFor,
	requiredRepetitions,
	SPOTS_FOR_KIND
} from './groupKinds';

const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, index) => first + index);

/*
 * The first three blocks are the server's table, written out as literals rather than imported:
 * the workspaces share no package, so a test here is the only thing that notices when
 * `apps/server/src/utils/groupKinds.ts` and this mirror stop saying the same thing.
 */
describe('groupKinds mirrors the server', () => {
	it('divides the Cevşen into a hundred parts, a hatim into thirty and the Hizb into thirty-three', () => {
		expect(PART_COUNT).toEqual({ CEVSEN: 100, HATIM: 30, HIZB: 33 });
		expect(partCountFor('CEVSEN')).toBe(100);
		expect(partCountFor('HATIM')).toBe(30);
		expect(partCountFor('HIZB')).toBe(33);
	});

	it('repeats Sekine nineteen times and nothing else more than once', () => {
		expect(requiredRepetitions('HIZB', 19)).toBe(19);
		expect(requiredRepetitions('HIZB', 18)).toBe(1);
		expect(requiredRepetitions('HIZB', 20)).toBe(1);
		expect(requiredRepetitions('CEVSEN', 19)).toBe(1);
		expect(requiredRepetitions('HATIM', 19)).toBe(1);
		expect(range(1, 33).filter(number => requiredRepetitions('HIZB', number) > 1)).toEqual([19]);
	});

	it('keeps the Cevşen to its two cycles, gives the Hizb a month and a hatim any round length', () => {
		expect(CYCLES_FOR_KIND).toEqual({
			CEVSEN: ['DAILY', 'WEEKLY'],
			HATIM: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
			HIZB: ['DAILY', 'WEEKLY', 'MONTHLY']
		});
	});

	it('splits a Şahsi Cevşen over up to ninety days and a Kur’an over up to thirty', () => {
		expect(PERSONAL_PLAN_MAX_DAYS).toEqual({ CEVSEN: 90, HATIM: 30 });
	});

	it('reads a group by plans when it has a Hizb plan or a plan length', () => {
		expect(isPersonalPlan({ hizbPlan: 0, planDays: null })).toBe(true);
		expect(isPersonalPlan({ hizbPlan: null, planDays: 10 })).toBe(true);
		expect(isPersonalPlan({ hizbPlan: null, planDays: null })).toBe(false);
	});
});

describe('SPOTS_FOR_KIND', () => {
	it('offers the Cevşen its three even sizes', () => {
		expect(SPOTS_FOR_KIND.CEVSEN).toEqual([5, 10, 20]);
	});

	it('pins a hatim at one seat per cüz', () => {
		expect(SPOTS_FOR_KIND.HATIM).toEqual([30]);
	});

	it('offers the Hizb every size from one seat to one seat per portion', () => {
		expect(SPOTS_FOR_KIND.HIZB).toEqual(range(1, PART_COUNT.HIZB));
	});
});

describe('CREATE_DEFAULTS_FOR_KIND', () => {
	it('opens the Cevşen on twenty seats, daily, rotating', () => {
		expect(CREATE_DEFAULTS_FOR_KIND.CEVSEN).toEqual({ cycle: 'DAILY', splitMode: 'ROTATION', spots: 20 });
	});

	it('opens the Hizb on one seat per portion, daily, rotating', () => {
		expect(CREATE_DEFAULTS_FOR_KIND.HIZB).toEqual({ cycle: 'DAILY', splitMode: 'ROTATION', spots: 33 });
	});

	it('opens a hatim on thirty seats, a thirty-day round, fixed', () => {
		expect(CREATE_DEFAULTS_FOR_KIND.HATIM).toEqual({ cycle: 'MONTHLY', splitMode: 'FIXED', spots: 30 });
	});

	it('only ever defaults to a size and a cycle its own kind accepts', () => {
		for (const kind of ['CEVSEN', 'HATIM', 'HIZB'] as const) {
			expect(SPOTS_FOR_KIND[kind]).toContain(CREATE_DEFAULTS_FOR_KIND[kind].spots);
			expect(CYCLES_FOR_KIND[kind]).toContain(CREATE_DEFAULTS_FOR_KIND[kind].cycle);
		}
	});
});
