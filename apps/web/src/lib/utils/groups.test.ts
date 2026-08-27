import { describe, expect, it } from 'vitest';
import type { GroupBab } from '@/lib/types/domain';
import { babCellState, type BabCellContext, toBabCells } from './groups';

const ME = 'user_me';
const OTHER = 'user_other';

const bab = (overrides: Partial<GroupBab> = {}): GroupBab => ({
	number: 1,
	assignedUserId: null,
	readByUserId: null,
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
