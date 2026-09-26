import { describe, expect, it } from 'vitest';
import { hizbPlanBoard } from './hizbPlanBoard';
import { spansFor } from './hizbPlans';

const reader = (planDays: number, portion: number, completed = false) => ({
	id: 'reader',
	displayName: 'Reader',
	planDays,
	portion,
	completed
});
describe('personal plan group board', () => {
	it('shows all 33 portions, highlights mine and distinguishes scheduled from unassigned', () => {
		const board = hizbPlanBoard([reader(33, 1)], [], { planDays: 33, portion: 1 });
		expect(board).toHaveLength(33);
		expect(board[0]).toMatchObject({ number: 1, state: 'pending', isMine: true });
		expect(board[1]).toMatchObject({ number: 2, state: 'empty', isMine: false });
	});
	it('maps a seven-day reading to the canonical portions and does not double count overlaps', () => {
		const board = hizbPlanBoard([reader(7, 1, true), reader(33, 1, true)], spansFor(7, 1), null);
		expect(board.filter(cell => cell.state === 'read').map(cell => cell.number)).toEqual([1, 2, 3, 4]);
	});
	it('shows partial coverage where a fifteen-day boundary splits a canonical portion', () => {
		const board = hizbPlanBoard([reader(15, 2, true)], spansFor(15, 2), null);
		expect(board[5]).toMatchObject({ number: 6, state: 'partial' });
		expect(board[3]?.state).toBe('read');
	});
	it('retains completed coverage after the reader leaves', () => {
		expect(hizbPlanBoard([], spansFor(33, 19), null)[18]).toMatchObject({ state: 'read', readers: [] });
	});
	it('does not count a pending Sekine assignment as read', () => {
		expect(hizbPlanBoard([reader(33, 19)], [], null)[18]?.state).toBe('pending');
	});
});
