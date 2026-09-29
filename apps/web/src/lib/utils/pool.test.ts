import type { PoolSlot, PoolSlotPart } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import type { HizbBoardCell } from './groups';
import {
	hizbPoolCells,
	hizbPoolRows,
	withPoolPartReleased,
	withPoolPartTaken,
	withPoolSlotReleased,
	withPoolSlotTaken
} from './pool';

const ME = 'user_me';
const OTHER = 'user_other';

const part = (number: number, overrides: Partial<PoolSlotPart> = {}): PoolSlotPart => ({
	number,
	takenByUserId: null,
	takenByDisplayName: null,
	takenByImageUrl: null,
	takenByMe: false,
	isRead: false,
	...overrides
});

const taken = (userId: string, name: string) => ({
	takenByUserId: userId,
	takenByDisplayName: name,
	takenByImageUrl: null,
	takenByMe: userId === ME
});

/** A slot whose own taker fields are whatever its first held part says, as the server builds it. */
const slot = (slotIndex: number, parts: PoolSlotPart[]): PoolSlot => {
	const holder = parts.find(candidate => candidate.takenByUserId !== null);

	return {
		slotIndex,
		start: parts[0]?.number ?? 0,
		end: parts[parts.length - 1]?.number ?? 0,
		babNumbers: parts.map(candidate => candidate.number),
		takenByUserId: holder?.takenByUserId ?? null,
		takenByDisplayName: holder?.takenByDisplayName ?? null,
		takenByImageUrl: holder?.takenByImageUrl ?? null,
		takenByMe: holder?.takenByMe ?? false,
		readCount: parts.filter(candidate => candidate.isRead).length,
		readBabNumbers: parts.filter(candidate => candidate.isRead).map(candidate => candidate.number),
		parts
	};
};

describe('withPoolPartTaken', () => {
	it('gives the viewer the one portion and nothing else in its block', () => {
		const [result] = withPoolPartTaken([slot(4, [part(13), part(14), part(15)])], 14, ME);

		expect(result?.parts.map(candidate => candidate.takenByMe)).toEqual([false, true, false]);
		expect(result?.parts[1]?.takenByUserId).toBe(ME);
	});

	it('names the viewer on the slot once theirs is its first held portion', () => {
		const [result] = withPoolPartTaken([slot(4, [part(13), part(14)])], 14, ME);

		expect(result?.takenByUserId).toBe(ME);
		expect(result?.takenByMe).toBe(true);
	});

	it('keeps an earlier claimant on the slot, as the server does', () => {
		const [result] = withPoolPartTaken([slot(4, [part(13, taken(OTHER, 'Ayşe')), part(14)])], 14, ME);

		expect(result?.takenByUserId).toBe(OTHER);
		expect(result?.takenByDisplayName).toBe('Ayşe');
		expect(result?.takenByMe).toBe(false);
		expect(result?.parts[1]?.takenByMe).toBe(true);
	});

	it('leaves a portion somebody already holds alone — the server would refuse it', () => {
		const slots = [slot(4, [part(13, taken(OTHER, 'Ayşe'))])];

		expect(withPoolPartTaken(slots, 13, ME)).toEqual(slots);
	});

	it('touches no other slot', () => {
		const other = slot(7, [part(22)]);
		const [, untouched] = withPoolPartTaken([slot(4, [part(13)]), other], 13, ME);

		expect(untouched).toBe(other);
	});
});

describe('withPoolPartReleased', () => {
	it('frees the viewer’s portion and hands the slot to whoever holds the next one', () => {
		const [result] = withPoolPartReleased(
			[slot(4, [part(13, taken(ME, 'Ben')), part(14, taken(OTHER, 'Ayşe'))])],
			13
		);

		expect(result?.parts[0]).toEqual(part(13));
		expect(result?.takenByUserId).toBe(OTHER);
		expect(result?.takenByMe).toBe(false);
	});

	it('takes the viewer’s read of it back too, as the release does', () => {
		const [result] = withPoolPartReleased(
			[slot(4, [part(13, { ...taken(ME, 'Ben'), isRead: true }), part(14)])],
			13
		);

		expect(result?.parts[0]?.isRead).toBe(false);
		expect(result?.readCount).toBe(0);
		expect(result?.readBabNumbers).toEqual([]);
	});

	it('clears the slot once nothing in it is held', () => {
		const [result] = withPoolPartReleased([slot(4, [part(13, taken(ME, 'Ben')), part(14)])], 13);

		expect(result?.takenByUserId).toBeNull();
		expect(result?.takenByDisplayName).toBeNull();
	});

	it('leaves somebody else’s portion alone — only the caller’s own claim comes off', () => {
		const slots = [slot(4, [part(13, { ...taken(OTHER, 'Ayşe'), isRead: true })])];

		expect(withPoolPartReleased(slots, 13)).toEqual(slots);
	});
});

describe('withPoolSlotTaken', () => {
	it('gives the viewer every part of a free slot, and the slot with them', () => {
		const [result] = withPoolSlotTaken([slot(4, [part(13), part(14), part(15)])], 4, ME);

		expect(result?.parts.every(candidate => candidate.takenByMe && candidate.takenByUserId === ME)).toBe(true);
		expect(result?.takenByUserId).toBe(ME);
		expect(result?.takenByMe).toBe(true);
	});

	it('takes only what is still free, as the server does — a portion someone holds stays theirs', () => {
		const [result] = withPoolSlotTaken([slot(4, [part(13, taken(OTHER, 'Ayşe')), part(14), part(15)])], 4, ME);

		expect(result?.parts.map(candidate => candidate.takenByUserId)).toEqual([OTHER, ME, ME]);
		// The slot keeps naming its first claimant.
		expect(result?.takenByUserId).toBe(OTHER);
	});

	it('changes nothing when nothing in the slot is free — the server would refuse it', () => {
		const slots = [slot(4, [part(13, taken(OTHER, 'Ayşe'))])];

		expect(withPoolSlotTaken(slots, 4, ME)).toEqual(slots);
	});

	it('touches no other slot', () => {
		const other = slot(7, [part(22)]);
		const [, untouched] = withPoolSlotTaken([slot(4, [part(13)]), other], 4, ME);

		expect(untouched).toBe(other);
	});

	it('leaves the parts in step, so a portion released before the refetch keeps the rest of the claim', () => {
		const takenWhole = withPoolSlotTaken([slot(4, [part(13), part(14), part(15)])], 4, ME);
		const [result] = withPoolPartReleased(takenWhole, 14);

		expect(result?.parts.map(candidate => candidate.takenByMe)).toEqual([true, false, true]);
		expect(result?.takenByMe).toBe(true);
	});
});

describe('withPoolSlotReleased', () => {
	it('frees every part the viewer holds, with their reads', () => {
		const [result] = withPoolSlotReleased(
			[slot(4, [part(13, { ...taken(ME, 'Ben'), isRead: true }), part(14, taken(ME, 'Ben'))])],
			4
		);

		expect(result?.parts).toEqual([part(13), part(14)]);
		expect(result?.takenByUserId).toBeNull();
		expect(result?.readCount).toBe(0);
	});

	it('leaves somebody else’s portions of the block where they are', () => {
		const [result] = withPoolSlotReleased(
			[slot(4, [part(13, taken(ME, 'Ben')), part(14, { ...taken(OTHER, 'Ayşe'), isRead: true })])],
			4
		);

		expect(result?.parts[1]?.takenByUserId).toBe(OTHER);
		expect(result?.takenByUserId).toBe(OTHER);
		expect(result?.readBabNumbers).toEqual([14]);
	});

	it('changes nothing in a slot the viewer holds none of', () => {
		const slots = [slot(4, [part(13, taken(OTHER, 'Ayşe'))])];

		expect(withPoolSlotReleased(slots, 4)).toEqual(slots);
	});
});

describe('hizbPoolCells', () => {
	const cells: HizbBoardCell[] = [
		{ isMine: false, number: 23, state: 'taken' },
		{ isMine: false, number: 24, state: 'pool' },
		{ isMine: true, number: 31, state: 'taken' }
	];

	it('leaves a portion outside the pool as the board has it', () => {
		expect(hizbPoolCells(cells, [slot(9, [part(24)])])[0]).toEqual(cells[0]);
	});

	it('fills a pool portion the moment the viewer takes it, before the board has heard', () => {
		const slots = withPoolPartTaken([slot(9, [part(24)])], 24, ME);

		expect(hizbPoolCells(cells, slots)[1]).toEqual({ isMine: true, number: 24, state: 'taken' });
	});

	it('hatches a portion the viewer has just handed back, whatever the board still says', () => {
		const slots = withPoolPartReleased([slot(12, [part(31, taken(ME, 'Ben'))])], 31);

		expect(hizbPoolCells(cells, slots)[2]).toEqual({ isMine: false, number: 31, state: 'pool' });
	});

	it('marks a pool portion read once its holder has read it', () => {
		const slots = [slot(9, [part(24, { ...taken(OTHER, 'Ayşe'), isRead: true })])];

		expect(hizbPoolCells(cells, slots)[1]).toEqual({ isMine: false, number: 24, state: 'read' });
	});
});

describe('hizbPoolRows', () => {
	const slots = [
		slot(9, [part(24), part(25, taken(OTHER, 'Ayşe'))]),
		slot(3, [part(7, taken(ME, 'Ben')), part(8, taken(ME, 'Ben'))]),
		slot(12, [part(31)])
	];

	it('offers every free portion and every portion the viewer holds, in order, across slots', () => {
		expect(hizbPoolRows(slots, new Set())).toEqual([
			{ isJustTaken: false, isMine: true, number: 7 },
			{ isJustTaken: false, isMine: true, number: 8 },
			{ isJustTaken: false, isMine: false, number: 24 },
			{ isJustTaken: false, isMine: false, number: 31 }
		]);
	});

	it('keeps a claim from before this session, so it can still be handed back', () => {
		const rows = hizbPoolRows(slots, new Set());

		expect(rows.find(row => row.number === 7)).toEqual({ isJustTaken: false, isMine: true, number: 7 });
	});

	it('marks a portion taken this session as just taken', () => {
		const rows = hizbPoolRows(slots, new Set([8]));

		expect(rows.find(row => row.number === 8)).toEqual({ isJustTaken: true, isMine: true, number: 8 });
		expect(rows.find(row => row.number === 7)?.isJustTaken).toBe(false);
	});

	it('lists nobody else’s claim, even one the viewer tried for this session', () => {
		const rows = hizbPoolRows(slots, new Set([25]));

		expect(rows.map(row => row.number)).toEqual([7, 8, 24, 31]);
	});

	it('does not call a free portion just taken, as after a refused take rolls back', () => {
		expect(hizbPoolRows(slots, new Set([24])).find(row => row.number === 24)?.isJustTaken).toBe(false);
	});
});
