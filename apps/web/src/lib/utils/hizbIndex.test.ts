import { describe, expect, it } from 'vitest';
import { HIZB_WORKS } from '@/lib/content/hizbPortions';
import type { GroupBab } from '@/lib/types/domain';
import { hizbIndexWorks } from './hizbIndex';

const ME = 'user_me';
const KEREM = 'user_kerem';
const RABIA = 'user_rabia';

/** All 32 portions, unread and unclaimed, with `overrides` applied by number. */
const board = (overrides: Record<number, Partial<GroupBab>> = {}): GroupBab[] =>
	Array.from({ length: 32 }, (_, index) => ({
		assignedUserId: null,
		number: index + 1,
		readAt: null,
		readByDisplayName: null,
		readByUserId: null,
		...overrides[index + 1]
	}));

const group = (
	overrides: Partial<Parameters<typeof hizbIndexWorks>[1]> = {}
): Parameters<typeof hizbIndexWorks>[1] => ({
	members: [],
	myBabNumbers: [],
	poolAllBabNumbers: [],
	poolBabNumbers: [],
	...overrides
});

const rowOf = (works: ReturnType<typeof hizbIndexWorks>, number: number) =>
	works.flatMap(entry => entry.rows).find(row => row.number === number);

describe('hizbIndexWorks', () => {
	it('lays the portions out work by work, in order, every one exactly once', () => {
		const works = hizbIndexWorks(board(), group());

		expect(works.map(entry => entry.work.key)).toEqual(HIZB_WORKS.map(work => work.key));
		expect(works.flatMap(entry => entry.rows.map(row => row.number))).toEqual(
			Array.from({ length: 32 }, (_, index) => index + 1)
		);
		expect(works[3]?.rows.map(row => row.number)).toEqual([14, 15, 16, 17, 18]);
	});

	it('names the member whose rotated share holds a portion', () => {
		const works = hizbIndexWorks(
			board(),
			group({ members: [{ babNumbers: [14], displayName: 'Kerem', userId: KEREM }] })
		);

		expect(rowOf(works, 14)).toEqual({ holderName: 'Kerem', isMine: false, number: 14, state: 'taken' });
	});

	it("leaves the viewer's own unnamed and rings it — the screen says Sen", () => {
		const works = hizbIndexWorks(
			board(),
			group({
				members: [{ babNumbers: [15, 16], displayName: 'Ayşe', userId: ME }],
				myBabNumbers: [15, 16]
			})
		);

		expect(rowOf(works, 15)).toEqual({ holderName: null, isMine: true, number: 15, state: 'taken' });
	});

	it('names a pool portion by whoever volunteered for it', () => {
		const works = hizbIndexWorks(
			board({ 24: { assignedUserId: RABIA } }),
			group({
				members: [{ babNumbers: [1, 2], displayName: 'Rabia', userId: RABIA }],
				poolAllBabNumbers: [24, 31],
				poolBabNumbers: [31]
			})
		);

		expect(rowOf(works, 24)).toEqual({ holderName: 'Rabia', isMine: false, number: 24, state: 'taken' });
		expect(rowOf(works, 31)).toEqual({ holderName: null, isMine: false, number: 31, state: 'pool' });
	});

	it("goes by the seat, not a claim stranded on a portion the seat's holder now has", () => {
		const works = hizbIndexWorks(
			board({ 8: { assignedUserId: RABIA } }),
			group({
				members: [
					{ babNumbers: [8], displayName: 'Kerem', userId: KEREM },
					{ babNumbers: [1], displayName: 'Rabia', userId: RABIA }
				]
			})
		);

		expect(rowOf(works, 8)?.holderName).toBe('Kerem');
	});

	it('keeps the holder of a read portion, and counts the reads per work', () => {
		const works = hizbIndexWorks(
			board({
				1: { readAt: '2026-09-26T08:00:00Z', readByUserId: KEREM },
				3: { readAt: '2026-09-26T09:00:00Z', readByUserId: KEREM }
			}),
			group({ members: [{ babNumbers: [1, 2, 3], displayName: 'Kerem', userId: KEREM }] })
		);

		expect(rowOf(works, 1)).toEqual({ holderName: 'Kerem', isMine: false, number: 1, state: 'read' });
		expect(works[0]?.readCount).toBe(2);
		expect(works[1]?.readCount).toBe(0);
	});

	it('names nobody for a claim by someone the member list does not have', () => {
		const works = hizbIndexWorks(
			board({ 24: { assignedUserId: 'user_gone' } }),
			group({ poolAllBabNumbers: [24] })
		);

		expect(rowOf(works, 24)).toEqual({ holderName: null, isMine: false, number: 24, state: 'taken' });
	});
});
