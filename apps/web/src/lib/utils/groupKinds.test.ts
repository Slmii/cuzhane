import { describe, expect, it } from 'vitest';
import {
	CREATE_DEFAULTS_FOR_KIND,
	CYCLES_FOR_KIND,
	PART_COUNT,
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
	it('divides the Cevşen into a hundred parts and the Hizb into thirty-three', () => {
		expect(PART_COUNT).toEqual({ CEVSEN: 100, HIZB: 33 });
		expect(partCountFor('CEVSEN')).toBe(100);
		expect(partCountFor('HIZB')).toBe(33);
	});

	it('repeats Sekine nineteen times and nothing else more than once', () => {
		expect(requiredRepetitions('HIZB', 19)).toBe(19);
		expect(requiredRepetitions('HIZB', 18)).toBe(1);
		expect(requiredRepetitions('HIZB', 20)).toBe(1);
		expect(requiredRepetitions('CEVSEN', 19)).toBe(1);
		expect(range(1, 33).filter(number => requiredRepetitions('HIZB', number) > 1)).toEqual([19]);
	});

	it('keeps the Cevşen to its two cycles and gives the Hizb a month as well', () => {
		expect(CYCLES_FOR_KIND).toEqual({ CEVSEN: ['DAILY', 'WEEKLY'], HIZB: ['DAILY', 'WEEKLY', 'MONTHLY'] });
	});
});

describe('SPOTS_FOR_KIND', () => {
	it('offers the Cevşen its three even sizes', () => {
		expect(SPOTS_FOR_KIND.CEVSEN).toEqual([5, 10, 20]);
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

	it('only ever defaults to a size and a cycle its own kind accepts', () => {
		for (const kind of ['CEVSEN', 'HIZB'] as const) {
			expect(SPOTS_FOR_KIND[kind]).toContain(CREATE_DEFAULTS_FOR_KIND[kind].spots);
			expect(CYCLES_FOR_KIND[kind]).toContain(CREATE_DEFAULTS_FOR_KIND[kind].cycle);
		}
	});
});
