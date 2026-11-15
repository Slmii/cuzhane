import { resolveUnitPlan } from '@services/unitPlan';
import { describe, expect, it } from 'vitest';

/*
 * The seam's own tests, and they are pure — no database, no fixtures. What is being checked
 * is that the two reading types answer the *same three questions* correctly, each by its own
 * rule: a Cevşen share is derived from a seat and the round, a hatim share is whatever rows
 * say. Everything above this file is allowed to stop caring which.
 */

const members = [
	{ slotIndex: 0, userId: 'u0' },
	{ slotIndex: 1, userId: 'u1' }
];

describe('resolveUnitPlan · Cevşen', () => {
	const group = { kind: 'CEVSEN' as const, splitMode: 'FIXED' as const, spots: 4 };

	it('derives a share from the seat and ignores holdings entirely', () => {
		const plan = resolveUnitPlan({ group, holdings: [{ cuzNumber: 7, userId: 'u1' }], members, roundIndex: 0 });

		expect(plan.unitCount).toBe(100);
		expect(plan.unitsFor('u0')).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
		expect(plan.unitsFor('u1')).toEqual(Array.from({ length: 25 }, (_, index) => index + 26));
	});

	it('calls the empty seats the pool and names the holder of everything else', () => {
		const plan = resolveUnitPlan({ group, holdings: [], members, roundIndex: 0 });

		// Seats 2 and 3 are unfilled, so babs 51–100 belong to nobody.
		expect(plan.poolUnits).toHaveLength(50);
		expect(plan.holderOf(1)).toBe('u0');
		expect(plan.holderOf(30)).toBe('u1');
		expect(plan.holderOf(51)).toBeNull();
	});

	it('rotates the share with the round', () => {
		const rotating = { ...group, splitMode: 'ROTATION' as const };

		// Seat 0 reads seat 1's block in round 1 — a whole seat on, not a fixed bab offset.
		expect(resolveUnitPlan({ group: rotating, holdings: [], members, roundIndex: 1 }).unitsFor('u0')[0]).toBe(26);
	});

	it('gives a gathering group its standing block, and still reports its pool', () => {
		const plan = resolveUnitPlan({ group, holdings: [], members, roundIndex: null });

		expect(plan.unitsFor('u0')[0]).toBe(1);
		// A group nobody has started still has two empty seats, and the invite preview asks
		// exactly this. Answering `[]` would make it look fully covered.
		expect(plan.poolUnits).toHaveLength(50);
		expect(plan.poolUnits[0]).toBe(51);
	});
});

describe('resolveUnitPlan · hatim', () => {
	const group = { kind: 'HATIM' as const, splitMode: 'FIXED' as const, spots: 4 };

	/** Non-contiguous on purpose: this is the shape no seat arithmetic can produce. */
	const holdings = [
		{ cuzNumber: 7, userId: 'u0' },
		{ cuzNumber: 22, userId: 'u0' },
		{ cuzNumber: 1, userId: 'u1' }
	];

	it('reads a share off the rows, scattered and unequal', () => {
		const plan = resolveUnitPlan({ group, holdings, members, roundIndex: 0 });

		expect(plan.unitCount).toBe(30);
		expect(plan.unitsFor('u0')).toEqual([7, 22]);
		expect(plan.unitsFor('u1')).toEqual([1]);
	});

	it('pools every cüz nobody holds', () => {
		const plan = resolveUnitPlan({ group, holdings, members, roundIndex: 0 });

		expect(plan.poolUnits).toHaveLength(27);
		expect(plan.poolUnits).not.toContain(7);
		expect(plan.poolUnits).toContain(30);
		expect(plan.holderOf(22)).toBe('u0');
		expect(plan.holderOf(30)).toBeNull();
	});

	it('gives a member with no seat a share, which a seat split cannot', () => {
		// Membership and holding are separate facts here: `members` carries two people and
		// four seats, while the cüz are held by whoever picked them.
		const plan = resolveUnitPlan({
			group,
			holdings: [{ cuzNumber: 12, userId: 'u9' }],
			members: [],
			roundIndex: 0
		});

		expect(plan.unitsFor('u9')).toEqual([12]);
	});

	it('never reaches past the thirtieth cüz', () => {
		const plan = resolveUnitPlan({ group, holdings: [], members, roundIndex: 0 });

		expect(plan.poolUnits.at(-1)).toBe(30);
	});
});
