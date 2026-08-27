import { describe, expect, it } from 'vitest';
import type { RoundBab } from '@/lib/types/domain';
import { roundCellStates, roundRows } from './rounds';

const ME = 'user_me';
const ALI = 'user_ali';
const HASAN = 'user_hasan';

const members = [
	{ userId: ME, displayName: 'Ayşe Y.' },
	{ userId: ALI, displayName: 'Ali D.' },
	{ userId: HASAN, displayName: 'Hasan T.' }
];

const bab = (overrides: Partial<RoundBab> & { number: number }): RoundBab => ({
	readByUserId: null,
	readAt: null,
	owedByUserId: null,
	owedBySlotIndex: null,
	isPool: false,
	...overrides
});

describe('roundCellStates', () => {
	it('marks a bab someone read as read', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ALI, readByUserId: ALI })] };
		expect(roundCellStates(round, ME)[1]).toBe('read');
	});

	it('separates your own miss from everyone else’s', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ME }), bab({ number: 2, owedByUserId: ALI })] };
		const states = roundCellStates(round, ME);

		expect(states[1]).toBe('missedMine');
		expect(states[2]).toBe('missed');
	});

	it('marks a bab of yours that someone else covered as takenByOther', () => {
		// The case plain "read" would erase — it was your share, and Hasan stepped in.
		const round = { babs: [bab({ number: 1, owedByUserId: ME, readByUserId: HASAN })] };
		expect(roundCellStates(round, ME)[1]).toBe('takenByOther');
	});

	it('does not call your own read a take-over', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ME, readByUserId: ME })] };
		expect(roundCellStates(round, ME)[1]).toBe('read');
	});

	it('marks an unread pool bab as pool, not as a miss', () => {
		// Nobody held the seat, so nobody failed to read it.
		const round = { babs: [bab({ number: 1, isPool: true })] };
		expect(roundCellStates(round, ME)[1]).toBe('pool');
	});

	it('shows a covered pool bab as read rather than staying hatched', () => {
		const round = { babs: [bab({ number: 1, isPool: true, readByUserId: ME })] };
		expect(roundCellStates(round, ME)[1]).toBe('read');
	});

	it('treats every miss as someone else’s when there is no viewer', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ME })] };
		expect(roundCellStates(round, null)[1]).toBe('missed');
	});
});

describe('roundRows', () => {
	it('gives a member a row for what they owed, even having read none of it', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ALI }), bab({ number: 2, owedByUserId: ALI })] };
		const [row] = roundRows(round, members, ME);

		expect(row?.name).toBe('Ali D.');
		expect(row?.outstanding).toEqual([1, 2]);
		expect(row?.rangeLabel).toBe('1–2');
	});

	it('names who covered another member’s babs rather than absorbing the credit', () => {
		const round = {
			babs: [
				bab({ number: 1, owedByUserId: ALI, readByUserId: HASAN }),
				bab({ number: 2, owedByUserId: ALI, readByUserId: ALI })
			]
		};
		const [row] = roundRows(round, members, ME);

		expect(row?.covered).toEqual({ byName: 'Hasan T.', isViewer: false, babNumbers: [1] });
		expect(row?.settledKey).toBe('transferred');
	});

	it('says the whole block was taken over when none of it was their own read', () => {
		const round = {
			babs: [
				bab({ number: 1, owedByUserId: ALI, readByUserId: HASAN }),
				bab({ number: 2, owedByUserId: ALI, readByUserId: HASAN })
			]
		};
		const [row] = roundRows(round, members, ME);

		expect(row?.settledKey).toBe('splitTaken');
	});

	it('credits babs you covered for others onto your own row', () => {
		const round = {
			babs: [
				bab({ number: 1, owedByUserId: ME, readByUserId: ME }),
				bab({ number: 5, owedByUserId: ALI, readByUserId: ME })
			]
		};
		const mine = roundRows(round, members, ME).find(row => row.isViewer);

		// Yours reads "devraldığın · 5. bab" — no name, because the name would be your own.
		expect(mine?.covered).toEqual({ byName: '', isViewer: true, babNumbers: [5] });
	});

	it('flags a cover done by the reader, so the screen can say "sen" not their own name', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ALI, readByUserId: ME })] };
		const [row] = roundRows(round, members, ME);

		expect(row?.covered?.isViewer).toBe(true);
	});

	it('reports how many were owed, so a full block is not printed as its own subset', () => {
		const round = { babs: [bab({ number: 51, owedByUserId: ALI }), bab({ number: 52, owedByUserId: ALI })] };
		const [row] = roundRows(round, members, ME);

		expect(row?.owedCount).toBe(2);
		expect(row?.outstanding).toHaveLength(2);
	});

	it('collects unowned blocks into a single pool row', () => {
		const round = {
			babs: [
				bab({ number: 91, isPool: true }),
				bab({ number: 92, isPool: true }),
				bab({ number: 1, owedByUserId: ALI })
			]
		};
		const pool = roundRows(round, members, ME).find(row => row.isPool);

		expect(pool?.outstanding).toEqual([91, 92]);
		expect(pool?.rangeLabel).toBe('91–92');
	});

	it('keeps rows in seat order so acting on one does not reshuffle the list', () => {
		// Ali is settled and Hasan is not, but Ali still comes first — ranking by what's
		// left would slide a row away the moment you tapped its Üstlen.
		const round = {
			babs: [
				bab({ number: 1, owedByUserId: ALI, readByUserId: ALI }),
				bab({ number: 5, owedByUserId: HASAN }),
				bab({ number: 6, owedByUserId: HASAN })
			]
		};
		const rows = roundRows(round, members, ME);

		expect(rows.map(row => row.name)).toEqual(['Ali D.', 'Hasan T.']);
	});

	it('always puts the pool row last', () => {
		const round = {
			babs: [bab({ number: 91, isPool: true }), bab({ number: 1, owedByUserId: ALI })]
		};
		const rows = roundRows(round, members, ME);

		expect(rows[rows.length - 1]?.isPool).toBe(true);
	});

	it('picks poolLeft for an unread pool block, which has no owner to have missed it', () => {
		// Verified here rather than on screen: the pool row sits below the fold on a full
		// group, so this branch is impractical to confirm by eye.
		const round = { babs: [bab({ number: 91, isPool: true }), bab({ number: 92, isPool: true })] };
		const [row] = roundRows(round, members, ME);

		expect(row?.detailKind).toBe('poolLeft');
	});

	it('picks wholeBlock when none of the block has been covered', () => {
		const round = { babs: [bab({ number: 51, owedByUserId: ALI }), bab({ number: 52, owedByUserId: ALI })] };

		expect(roundRows(round, members, ME)[0]?.detailKind).toBe('wholeBlock');
	});

	it('picks partial once some of the block has been covered', () => {
		const round = {
			babs: [bab({ number: 51, owedByUserId: ALI, readByUserId: HASAN }), bab({ number: 52, owedByUserId: ALI })]
		};

		expect(roundRows(round, members, ME)[0]?.detailKind).toBe('partial');
	});

	it('picks settled once nothing is outstanding', () => {
		const round = { babs: [bab({ number: 51, owedByUserId: ALI, readByUserId: ALI })] };

		expect(roundRows(round, members, ME)[0]?.detailKind).toBe('settled');
	});

	it('settles the pool row too once its block has been covered', () => {
		const round = { babs: [bab({ number: 91, isPool: true, readByUserId: ME })] };
		const pool = roundRows(round, members, ME).find(row => row.isPool);

		expect(pool?.detailKind).toBe('settled');
	});

	it('reports no settled phrasing while work is still outstanding', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ALI })] };
		expect(roundRows(round, members, ME)[0]?.settledKey).toBeNull();
	});
});
