import { describe, expect, it } from 'vitest';
import type { GroupBab } from '@/lib/types/domain';
import {
	babCellState,
	type BabCellContext,
	cycleLabelKey,
	cycleOptionsFor,
	emptyBabCells,
	hizbSeatColumns,
	movesEachRound,
	partLabelKey,
	partUnitKey,
	planPreviewRows,
	staggerWithinRuns,
	toBabCells,
	toPoolCells
} from './groups';

const ME = 'user_me';
const OTHER = 'user_other';

const bab = (overrides: Partial<GroupBab> = {}): GroupBab => ({
	number: 1,
	assignedUserId: null,
	readByUserId: null,
	readByDisplayName: null,
	readAt: null,
	...overrides
});

const context = (overrides: Partial<BabCellContext> = {}): BabCellContext => ({
	viewerUserId: ME,
	myBabNumbers: new Set(),
	poolBabNumbers: new Set(),
	...overrides
});

describe('babCellState', () => {
	it('marks an unread bab in my share as mineUnread', () => {
		expect(babCellState(bab({ number: 5 }), context({ myBabNumbers: new Set([5]) }))).toBe('mineUnread');
	});

	it('marks an unread bab in the pool as pool', () => {
		expect(babCellState(bab({ number: 5 }), context({ poolBabNumbers: new Set([5]) }))).toBe('pool');
	});

	it('marks an unread bab in neither set as takenByOthers — some other member’s share this round', () => {
		expect(babCellState(bab({ number: 5 }), context())).toBe('takenByOthers');
	});

	it('marks a bab I read as readByMe', () => {
		const read = bab({ readByUserId: ME, readAt: '2026-08-25T10:00:00.000Z' });
		expect(babCellState(read, context())).toBe('readByMe');
	});

	it('marks a bab someone else read as readByOthers', () => {
		const read = bab({ readByUserId: OTHER, readAt: '2026-08-25T10:00:00.000Z' });
		expect(babCellState(read, context())).toBe('readByOthers');
	});

	it('lets readByMe win over every other state, including a bab that is also in the pool set', () => {
		const read = bab({ number: 5, readByUserId: ME, readAt: '2026-08-25T10:00:00.000Z' });
		expect(babCellState(read, context({ poolBabNumbers: new Set([5]) }))).toBe('readByMe');
	});

	it('treats every read bab as someone else’s when there is no viewer', () => {
		const read = bab({ readByUserId: ME, readAt: '2026-08-25T10:00:00.000Z' });
		expect(babCellState(read, context({ viewerUserId: null }))).toBe('readByOthers');
	});
});

describe('toBabCells', () => {
	it('preserves order and pairs each number with its state', () => {
		const babs = [
			bab({ number: 1 }),
			bab({ number: 2, readByUserId: OTHER, readAt: '2026-08-25T10:00:00.000Z' }),
			bab({ number: 3 })
		];

		expect(toBabCells(babs, { viewerUserId: ME, myBabNumbers: [1], poolBabNumbers: [3] })).toEqual([
			{ number: 1, state: 'mineUnread' },
			{ number: 2, state: 'readByOthers' },
			{ number: 3, state: 'pool' }
		]);
	});
});

describe('toPoolCells', () => {
	it('keeps the claimed blocks in the pool, telling mine apart from somebody else’s', () => {
		const babs = [
			bab({ number: 1, assignedUserId: ME }),
			bab({ number: 2, assignedUserId: OTHER }),
			bab({ number: 3 })
		];

		expect(toPoolCells(babs, { poolAllBabNumbers: [1, 2, 3], viewerUserId: ME })).toEqual([
			{ number: 1, state: 'takenByMe' },
			{ number: 2, state: 'takenByOthers' },
			{ number: 3, state: 'open' }
		]);
	});

	it('leaves out babs outside the pool — somebody’s seat this round', () => {
		const babs = [bab({ number: 1 }), bab({ number: 2 })];

		expect(toPoolCells(babs, { poolAllBabNumbers: [2], viewerUserId: ME })).toEqual([{ number: 2, state: 'open' }]);
	});

	it('leaves out a claim stranded on a seat somebody has since joined', () => {
		// The real case: a member volunteered for an empty seat's block, someone joined that
		// seat, and the claim outlived it. Inferring pool membership from `assignedUserId`
		// drew those babs on the group card while the Havuz screen rightly omitted them.
		const babs = [bab({ number: 1, assignedUserId: OTHER }), bab({ number: 2, assignedUserId: ME })];

		expect(toPoolCells(babs, { poolAllBabNumbers: [2], viewerUserId: ME })).toEqual([
			{ number: 2, state: 'takenByMe' }
		]);
	});

	it('still reports the pool once every block has been claimed', () => {
		const babs = [bab({ number: 1, assignedUserId: OTHER }), bab({ number: 2, assignedUserId: ME })];

		// An emptied *unclaimed* list used to hide the card entirely.
		expect(toPoolCells(babs, { poolAllBabNumbers: [1, 2], viewerUserId: ME })).toHaveLength(2);
	});

	it('claims nothing for a viewer who is not signed in', () => {
		const babs = [bab({ number: 1, assignedUserId: ME })];

		expect(toPoolCells(babs, { poolAllBabNumbers: [1], viewerUserId: null })).toEqual([
			{ number: 1, state: 'takenByOthers' }
		]);
	});

	it('orders by bab number whatever order the babs arrive in', () => {
		const babs = [bab({ number: 9, assignedUserId: ME }), bab({ number: 2 })];

		expect(toPoolCells(babs, { poolAllBabNumbers: [2, 9], viewerUserId: ME }).map(cell => cell.number)).toEqual([
			2, 9
		]);
	});
});

describe('staggerWithinRuns', () => {
	it('restarts the sweep at every run, so one block fills without waiting on the last', () => {
		expect(staggerWithinRuns(['a', 'a', 'a', 'b', 'b'], 70)).toEqual([0, 70, 140, 0, 70]);
	});

	it('counts from the start of the run, not the start of the grid', () => {
		// The case that matters: claiming the third block must not wait out the first two.
		const delays = staggerWithinRuns([0, 0, 1, 1, 2, 2], 70);

		expect(delays[4]).toBe(0);
		expect(delays[5]).toBe(70);
	});

	it('drains a reversed run the way it filled, backwards', () => {
		// Undo is the üstlen sweep played in reverse: the block's last cell goes first and the
		// wave retreats to where it started, over the same span.
		expect(staggerWithinRuns(['a', 'a', 'a', 'b', 'b'], 70, new Set(['a']))).toEqual([140, 70, 0, 0, 70]);
	});

	it('reverses only the runs it is asked to', () => {
		const delays = staggerWithinRuns([0, 0, 1, 1, 1], 70, new Set([1]));

		expect(delays.slice(0, 2)).toEqual([0, 70]);
		expect(delays.slice(2)).toEqual([140, 70, 0]);
	});

	it('treats a repeated key after a break as a new run', () => {
		expect(staggerWithinRuns(['a', 'b', 'a'], 70)).toEqual([0, 0, 0]);
	});

	it('gives one long run an increasing delay', () => {
		expect(staggerWithinRuns(['a', 'a', 'a'], 70)).toEqual([0, 70, 140]);
	});

	it('survives an empty grid', () => {
		expect(staggerWithinRuns([], 70)).toEqual([]);
	});
});

describe('cycleOptionsFor', () => {
	it('offers a Cevşen group its day and its week', () => {
		expect(cycleOptionsFor('CEVSEN')).toEqual(['DAILY', 'WEEKLY']);
	});

	it('offers a Hizb group a month as well', () => {
		expect(cycleOptionsFor('HIZB')).toEqual(['DAILY', 'WEEKLY', 'MONTHLY']);
	});
});

describe('cycleLabelKey', () => {
	it('names every cycle, the month included', () => {
		expect(cycleLabelKey('DAILY')).toBe('daily');
		expect(cycleLabelKey('WEEKLY')).toBe('weekly');
		expect(cycleLabelKey('MONTHLY')).toBe('monthly');
	});
});

describe('part nouns', () => {
	it('counts a Cevşen in babs and a Hizb in portions', () => {
		expect(partUnitKey('CEVSEN')).toBe('babs');
		expect(partUnitKey('HIZB')).toBe('portions');
	});

	it('titles one part the same way', () => {
		expect(partLabelKey('CEVSEN')).toBe('bab');
		expect(partLabelKey('HIZB')).toBe('portion');
	});
});

describe('emptyBabCells', () => {
	it('lays out as many open cells as the group has parts, numbered from one', () => {
		const cells = emptyBabCells(33);

		expect(cells).toHaveLength(33);
		expect(cells[0]).toEqual({ number: 1, state: 'open' });
		expect(cells[32]).toEqual({ number: 33, state: 'open' });
	});
});

describe('planPreviewRows', () => {
	const ranges = (rows: ReturnType<typeof planPreviewRows>) => rows.map(row => `${row.start}–${row.end}`);

	it('walks the Hizb forward a block a round, the first seat carrying the odd portion', () => {
		// 33 over 16: seat 0 holds three (33 % 16 = 1), every other seat two.
		const rows = planPreviewRows({ maxRounds: 4, partCount: 33, slotIndex: 0, splitMode: 'ROTATION', spots: 16 });

		expect(ranges(rows)).toEqual(['1–3', '4–5', '6–7', '8–9']);
		expect(rows.map(row => row.roundIndex)).toEqual([0, 1, 2, 3]);
		expect(rows.every(row => !row.isEveryRound)).toBe(true);
		expect(movesEachRound('ROTATION', 16)).toBe(true);
		expect(rows[0]?.offset).toBe(0);
		expect(rows[0]?.width).toBeCloseTo((3 / 33) * 100);
		expect(rows[1]?.offset).toBeCloseTo((3 / 33) * 100);
	});

	it('never shows more rounds than there are seats', () => {
		const rows = planPreviewRows({ maxRounds: 4, partCount: 33, slotIndex: 0, splitMode: 'ROTATION', spots: 2 });

		expect(ranges(rows)).toEqual(['1–17', '18–33']);
	});

	it('gives a lone seat the whole book in one row, read every round', () => {
		const rows = planPreviewRows({ maxRounds: 4, partCount: 33, slotIndex: 0, splitMode: 'ROTATION', spots: 1 });

		expect(ranges(rows)).toEqual(['1–33']);
		expect(rows[0]?.width).toBe(100);
		// Labelled "Her tur" like the caption, not "1. tur" beneath a caption saying every round.
		expect(rows[0]?.isEveryRound).toBe(true);
		expect(movesEachRound('ROTATION', 1)).toBe(false);
	});

	it('holds one unmoving range under FIXED', () => {
		const rows = planPreviewRows({ maxRounds: 4, partCount: 33, slotIndex: 0, splitMode: 'FIXED', spots: 11 });

		expect(ranges(rows)).toEqual(['1–3']);
		expect(rows[0]?.isEveryRound).toBe(true);
		expect(movesEachRound('FIXED', 11)).toBe(false);
	});

	it('draws the Cevşen as it always has', () => {
		const rows = planPreviewRows({ maxRounds: 4, partCount: 100, slotIndex: 0, splitMode: 'ROTATION', spots: 20 });

		expect(ranges(rows)).toEqual(['1–5', '6–10', '11–15', '16–20']);
		expect(rows.map(row => row.offset)).toEqual([0, 5, 10, 15]);
		expect(rows.map(row => row.width)).toEqual([5, 5, 5, 5]);
	});
});

describe('hizbSeatColumns', () => {
	it('keeps the ten-wide row for a small group', () => {
		expect(hizbSeatColumns(1)).toBe(10);
		expect(hizbSeatColumns(5)).toBe(10);
		expect(hizbSeatColumns(10)).toBe(10);
	});

	it('lays sixteen out as HC4 does, two rows of eight', () => {
		expect(hizbSeatColumns(16)).toBe(8);
	});

	it('lays the full 33 out as three rows of eleven', () => {
		expect(hizbSeatColumns(33)).toBe(11);
	});

	it('evens the rows out without going narrower than eight', () => {
		expect(hizbSeatColumns(11)).toBe(11);
		// Evened out alone these would be two rows of six and three rows of eight — the floor
		// holds the first at eight rather than letting the cells double in size.
		expect(hizbSeatColumns(12)).toBe(8);
		expect(hizbSeatColumns(23)).toBe(8);
		expect(hizbSeatColumns(17)).toBe(9);
	});

	it('stays between eight and eleven columns for every size a Hizb group can have', () => {
		for (let spots = 1; spots <= 33; spots += 1) {
			expect(hizbSeatColumns(spots)).toBeGreaterThanOrEqual(8);
			expect(hizbSeatColumns(spots)).toBeLessThanOrEqual(11);
		}
	});
});
