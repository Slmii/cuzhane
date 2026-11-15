import { describe, expect, it } from 'vitest';
import type { RoundBab } from '@/lib/types/domain';
import {
	hizbMissedNote,
	hizbRoundAction,
	hizbRoundCells,
	hizbRoundRows,
	joinWithAnd,
	missedPeopleCount,
	roundCellStates,
	roundDateRange,
	roundRows
} from './rounds';

const ME = 'user_me';
const ALI = 'user_ali';
const HASAN = 'user_hasan';

const members = [
	{ userId: ME, displayName: 'Ayşe Y.', imageUrl: null },
	{ userId: ALI, displayName: 'Ali D.', imageUrl: 'https://img.example/ali.jpg' },
	{ userId: HASAN, displayName: 'Hasan T.', imageUrl: null }
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

	it('carries a member’s photo onto their row, and leaves the pool without one', () => {
		const round = {
			babs: [bab({ number: 1, owedByUserId: ALI }), bab({ number: 2, owedByUserId: null })]
		};
		const rows = roundRows(round, members, ME);

		expect(rows.find(row => row.name === 'Ali D.')?.imageUrl).toBe('https://img.example/ali.jpg');
		// The pool is nobody — a face there would say a person owed those babs.
		expect(rows.find(row => row.isPool)?.imageUrl).toBeNull();
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
		// Not "sen üstlendin": Hasan did the covering, and the line under the row names him.
		expect(row?.settledKey).toBe('noMisses');
	});

	it('says "you took these" on a partly covered block only when the viewer covered it', () => {
		const round = {
			babs: [
				bab({ number: 1, owedByUserId: ALI, readByUserId: ME }),
				bab({ number: 2, owedByUserId: ALI, readByUserId: ALI })
			]
		};

		expect(roundRows(round, members, ME)[0]?.settledKey).toBe('transferred');
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

	it('names scattered cüz as they are, not as a span over the gap', () => {
		const round = {
			babs: [bab({ number: 7, owedByUserId: ALI }), bab({ number: 22, owedByUserId: ALI })]
		};

		expect(roundRows(round, members, ME)[0]?.rangeLabel).toBe('7, 22');
	});

	it('credits the viewer with a settled pool block only when they read all of it', () => {
		const mine = { babs: [bab({ number: 91, isPool: true, readByUserId: ME })] };
		const theirs = { babs: [bab({ number: 91, isPool: true, readByUserId: HASAN })] };
		const shared = {
			babs: [
				bab({ number: 91, isPool: true, readByUserId: ME }),
				bab({ number: 92, isPool: true, readByUserId: HASAN })
			]
		};

		expect(roundRows(mine, members, ME).find(row => row.isPool)?.settledKey).toBe('transferred');
		expect(roundRows(theirs, members, ME).find(row => row.isPool)?.settledKey).toBe('splitTaken');
		expect(roundRows(shared, members, ME).find(row => row.isPool)?.settledKey).toBe('splitTaken');
	});

	it('reports no settled phrasing while work is still outstanding', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ALI })] };
		expect(roundRows(round, members, ME)[0]?.settledKey).toBeNull();
	});
});

// Stands in for the app's `t`: the key with its values, so a test asserts on what was chosen.
const t = (key: string, values?: Record<string, string | number>) =>
	values === undefined
		? key
		: `${key}(${Object.entries(values)
				.map(([name, value]) => `${name}=${value}`)
				.join(',')})`;

describe('roundDateRange', () => {
	// Rounds open at midnight in the group's zone — 21:00 UTC the evening before, in Istanbul.
	const IST = 'Europe/Istanbul';

	it('says the month once for a week inside it', () => {
		expect(roundDateRange('2026-09-12T21:00:00.000Z', '2026-09-19T21:00:00.000Z', 'tr', IST)).toBe('13–19 Eyl');
	});

	it('keeps the language’s own order inside one month', () => {
		expect(roundDateRange('2026-09-12T21:00:00.000Z', '2026-09-19T21:00:00.000Z', 'en', IST)).toBe('Sep 13–19');
	});

	it('names both months for a week that crosses one', () => {
		expect(roundDateRange('2026-08-29T21:00:00.000Z', '2026-09-05T21:00:00.000Z', 'tr', IST)).toBe(
			'30 Ağu – 5 Eyl'
		);
	});

	it('writes a monthly round as a span across two months', () => {
		expect(roundDateRange('2026-09-19T21:00:00.000Z', '2026-10-19T21:00:00.000Z', 'tr', IST)).toBe(
			'20 Eyl – 19 Eki'
		);
		expect(roundDateRange('2026-09-19T21:00:00.000Z', '2026-10-19T21:00:00.000Z', 'nl', IST)).toBe(
			'20 sep – 19 okt'
		);
	});

	it('gives a daily round one date', () => {
		expect(roundDateRange('2026-09-19T21:00:00.000Z', '2026-09-20T21:00:00.000Z', 'tr', IST)).toBe('20 Eyl');
	});

	it('reads the days in the group’s zone, not the device’s', () => {
		// The same instants, read in New York, fall on the evening before each Istanbul midnight.
		expect(roundDateRange('2026-09-12T21:00:00.000Z', '2026-09-19T21:00:00.000Z', 'en', 'America/New_York')).toBe(
			'Sep 12–19'
		);
	});
});

describe('joinWithAnd', () => {
	it('joins the last two with the word and the rest with commas', () => {
		expect(joinWithAnd([16, 24, 31], 've')).toBe('16, 24 ve 31');
		expect(joinWithAnd([16, 24], 'and')).toBe('16 and 24');
	});

	it('leaves a single item alone, and nothing as nothing', () => {
		expect(joinWithAnd([19], 'en')).toBe('19');
		expect(joinWithAnd([], 'en')).toBe('');
	});
});

describe('hizbMissedNote', () => {
	it('names up to three missed portions, in order', () => {
		expect(hizbMissedNote({ count: 3, numbers: [31, 16, 24] }, t)).toBe(
			'roundMissedPartsHizb(parts=16, 24 listAnd 31)'
		);
	});

	it('uses the singular line for one', () => {
		expect(hizbMissedNote({ count: 1, numbers: [19] }, t)).toBe('roundMissedPartsHizbOne(parts=19)');
	});

	it('counts once there are more than three', () => {
		expect(hizbMissedNote({ count: 4, numbers: [1, 2, 3, 4] }, t)).toBe('roundMissedCountHizb(count=4)');
	});

	it('counts when the numbers are not known', () => {
		expect(hizbMissedNote({ count: 2, numbers: null }, t)).toBe('roundMissedCountHizb(count=2)');
		expect(hizbMissedNote({ count: 1, numbers: null }, t)).toBe('roundMissedCountHizbOne(count=1)');
	});

	it('does not name numbers that disagree with the count', () => {
		expect(hizbMissedNote({ count: 2, numbers: [16] }, t)).toBe('roundMissedCountHizb(count=2)');
	});

	it('says nothing for a round that missed nothing', () => {
		expect(hizbMissedNote({ count: 0, numbers: [] }, t)).toBeNull();
	});
});

describe('hizbRoundCells', () => {
	it('rings your portions whether they were read or missed', () => {
		const round = {
			babs: [bab({ number: 16, owedByUserId: ME }), bab({ number: 15, owedByUserId: ME, readByUserId: ME })]
		};

		expect(hizbRoundCells(round, ME)).toEqual([
			{ isMine: true, number: 15, state: 'read' },
			{ isMine: true, number: 16, state: 'missed' }
		]);
	});

	it('calls a portion read by anyone but its owner taken, pool portions included', () => {
		const round = {
			babs: [
				bab({ number: 23, owedByUserId: ALI, readByUserId: HASAN }),
				bab({ number: 31, isPool: true, readByUserId: ME })
			]
		};

		expect(hizbRoundCells(round, ME).map(cell => cell.state)).toEqual(['taken', 'taken']);
	});

	it('leaves an unread pool portion in the pool and an unread owed one missed', () => {
		const round = { babs: [bab({ number: 24, owedByUserId: ALI }), bab({ number: 31, isPool: true })] };

		expect(hizbRoundCells(round, ME)).toEqual([
			{ isMine: false, number: 24, state: 'missed' },
			{ isMine: false, number: 31, state: 'pool' }
		]);
	});

	it('rings nothing without a viewer', () => {
		const round = { babs: [bab({ number: 1, owedByUserId: ME })] };

		expect(hizbRoundCells(round, null)[0]?.isMine).toBe(false);
	});
});

describe('hizbRoundAction', () => {
	it('covers every ordinary portion in one write', () => {
		expect(hizbRoundAction([23, 24])).toEqual({ kind: 'cover', partNumbers: [23, 24] });
	});

	it('sends Sekine to the reader rather than marking it', () => {
		expect(hizbRoundAction([19])).toEqual({ kind: 'read', partNumber: 19 });
	});

	it('covers the rest of a block first, and leaves Sekine for the reader', () => {
		expect(hizbRoundAction([18, 19])).toEqual({ kind: 'cover', partNumbers: [18] });
	});

	it('has nothing to do once nothing is outstanding', () => {
		expect(hizbRoundAction([])).toBeNull();
	});
});

describe('hizbRoundRows', () => {
	const round = {
		babs: [
			bab({ number: 15, owedByUserId: ME, readByUserId: ME }),
			bab({ number: 16, owedByUserId: ME }),
			bab({ number: 23, owedByUserId: ALI, readByUserId: ALI }),
			bab({ number: 24, owedByUserId: ALI }),
			bab({ number: 25, owedByUserId: HASAN, readByUserId: HASAN }),
			bab({ number: 5, isPool: true, readByUserId: HASAN }),
			bab({ number: 31, isPool: true })
		]
	};

	it('lists only the rows with something outstanding, in seat order, pool last', () => {
		expect(hizbRoundRows(round, members, ME, new Set()).map(row => row.key)).toEqual([ME, ALI, 'pool']);
	});

	it('keeps a row the viewer settled on this visit, with nothing left to do', () => {
		const rows = hizbRoundRows(round, members, ME, new Set([HASAN]));
		const hasan = rows.find(row => row.key === HASAN);

		expect(hasan?.action).toBeNull();
		expect(hasan?.detailKind).toBe('settled');
	});

	it('writes each row’s portions as a set, not a span', () => {
		const rows = hizbRoundRows(round, members, ME, new Set());

		expect(rows.find(row => row.key === ME)?.partsLabel).toBe('15–16');
		// Two empty seats' portions, far apart: "5–31" would claim the twenty-five between.
		expect(rows.find(row => row.isPool)?.partsLabel).toBe('5, 31');
	});

	it('gives each row the action its outstanding portions call for', () => {
		const rows = hizbRoundRows(round, members, ME, new Set());

		expect(rows.find(row => row.key === ALI)?.action).toEqual({ kind: 'cover', partNumbers: [24] });
		expect(rows.find(row => row.isPool)?.action).toEqual({ kind: 'cover', partNumbers: [31] });
	});
});

describe('missedPeopleCount', () => {
	it('counts each member still owing once, and never the pool', () => {
		const round = {
			babs: [
				bab({ number: 15, owedByUserId: ME, readByUserId: ME }),
				bab({ number: 16, owedByUserId: ME }),
				bab({ number: 23, owedByUserId: ALI }),
				bab({ number: 24, owedByUserId: ALI }),
				bab({ number: 31, isPool: true })
			]
		};

		expect(missedPeopleCount(round)).toBe(2);
	});

	it('drops a member once their last portion is covered, whoever covered it', () => {
		const round = {
			babs: [bab({ number: 16, owedByUserId: ME, readByUserId: HASAN }), bab({ number: 24, owedByUserId: ALI })]
		};

		expect(missedPeopleCount(round)).toBe(1);
	});
});
