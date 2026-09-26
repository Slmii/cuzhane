import type { RoundBab } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import {
	canMarkPortion,
	countsRepetitions,
	markFailureKind,
	openRoundShares,
	pastRoundShares,
	portionOwnership,
	stepHizbPage,
	type PortionMarkDecision,
	type PortionMarkInput
} from './hizbReader';

const ME = 'user_me';
const OTHER = 'user_other';

const open = (overrides: Partial<PortionMarkInput>): PortionMarkInput => ({
	count: 0,
	isMissedInRound: true,
	isPastRound: false,
	ownership: 'mine',
	required: 1,
	...overrides
});

const past = (overrides: Partial<PortionMarkInput>): PortionMarkInput => open({ isPastRound: true, ...overrides });

describe('canMarkPortion', () => {
	const cases: [string, PortionMarkInput, PortionMarkDecision][] = [
		['mine, open, read once', open({}), { action: 'read', isDisabled: false, reason: null }],
		[
			'mine, open, Sekine at 18',
			open({ count: 18, required: 19 }),
			{ action: 'read', isDisabled: true, reason: 'repetitions' }
		],
		[
			'mine, open, Sekine at 19',
			open({ count: 19, required: 19 }),
			{ action: 'read', isDisabled: false, reason: null }
		],
		[
			'mine, open, already read by me',
			open({ isMissedInRound: false, isReadByViewer: true }),
			{ action: 'unread', isDisabled: false, reason: null }
		],
		[
			// Undoing never checks the count — the server doesn't either.
			'mine, open, Sekine read by me with the count since lowered',
			open({ count: 4, isMissedInRound: false, isReadByViewer: true, required: 19 }),
			{ action: 'unread', isDisabled: false, reason: null }
		],
		[
			'mine, open, read by whoever held it before',
			open({ isMissedInRound: false, isReadByViewer: false }),
			{ action: 'none', isDisabled: true, reason: 'alreadyRead' }
		],
		['pool, open', open({ ownership: 'pool' }), { action: 'takeAndRead', isDisabled: false, reason: null }],
		[
			'pool, open, Sekine at 18',
			open({ count: 18, ownership: 'pool', required: 19 }),
			{ action: 'takeAndRead', isDisabled: true, reason: 'repetitions' }
		],
		['other, open', open({ ownership: 'other' }), { action: 'none', isDisabled: true, reason: 'notYours' }],
		[
			// No counting on somebody else's Sekine, so its count never unlocks it.
			'other, open, Sekine at 19',
			open({ count: 19, ownership: 'other', required: 19 }),
			{ action: 'none', isDisabled: true, reason: 'notYours' }
		],
		['past round, missed, own', past({ ownership: 'mine' }), { action: 'cover', isDisabled: false, reason: null }],
		[
			'past round, missed, another member’s',
			past({ ownership: 'other' }),
			{ action: 'cover', isDisabled: false, reason: null }
		],
		['past round, missed, pool', past({ ownership: 'pool' }), { action: 'cover', isDisabled: false, reason: null }],
		[
			'past round, already read',
			past({ isMissedInRound: false }),
			{ action: 'none', isDisabled: true, reason: 'alreadyRead' }
		],
		[
			'past round, Sekine at 18',
			past({ count: 18, required: 19 }),
			{ action: 'cover', isDisabled: true, reason: 'repetitions' }
		],
		[
			'past round, Sekine at 19',
			past({ count: 19, required: 19 }),
			{ action: 'cover', isDisabled: false, reason: null }
		]
	];

	it.each(cases)('%s', (_label, input, expected) => {
		expect(canMarkPortion(input)).toEqual(expected);
	});
});

describe('countsRepetitions', () => {
	it('draws the counter wherever the portion can still be marked, or undone', () => {
		expect(countsRepetitions(canMarkPortion(open({ count: 3, required: 19 })), 19)).toBe(true);
		expect(countsRepetitions(canMarkPortion(open({ ownership: 'pool', required: 19 })), 19)).toBe(true);
		expect(countsRepetitions(canMarkPortion(past({ ownership: 'other', required: 19 })), 19)).toBe(true);
		expect(
			countsRepetitions(canMarkPortion(open({ isMissedInRound: false, isReadByViewer: true, required: 19 })), 19)
		).toBe(true);
	});

	it('leaves another member’s Sekine, and a filled gap, uncounted', () => {
		expect(countsRepetitions(canMarkPortion(open({ ownership: 'other', required: 19 })), 19)).toBe(false);
		expect(countsRepetitions(canMarkPortion(past({ isMissedInRound: false, required: 19 })), 19)).toBe(false);
	});

	it('draws nothing for a portion read once', () => {
		expect(countsRepetitions(canMarkPortion(open({})), 1)).toBe(false);
	});
});

describe('portion shares and ownership', () => {
	it('reads the open round off the group and its board', () => {
		const shares = openRoundShares({ myBabNumbers: [4, 5, 19], poolBabNumbers: [20] }, [
			{ number: 4, readAt: '2026-09-26T08:00:00.000Z' },
			{ number: 5, readAt: null },
			{ number: 20, readAt: null }
		]);

		expect(shares).toEqual({ myBabNumbers: [4, 5, 19], poolBabNumbers: [20], readBabNumbers: [4] });
		expect(portionOwnership(19, shares)).toBe('mine');
		expect(portionOwnership(20, shares)).toBe('pool');
		expect(portionOwnership(21, shares)).toBe('other');
	});

	it('reads a closed round off its own record, not off today’s share', () => {
		const bab = (number: number, overrides: Partial<RoundBab>): RoundBab => ({
			isPool: false,
			number,
			owedByUserId: OTHER,
			owedBySlotIndex: 1,
			readAt: null,
			readByUserId: null,
			...overrides
		});
		const round = {
			babs: [
				bab(1, { owedByUserId: ME, owedBySlotIndex: 0 }),
				bab(2, { readAt: '2026-09-20T08:00:00.000Z', readByUserId: OTHER }),
				bab(3, { isPool: true, owedByUserId: null, owedBySlotIndex: null }),
				bab(4, { isPool: true, owedByUserId: null, owedBySlotIndex: null, readByUserId: ME })
			]
		};
		const shares = pastRoundShares(round, ME);

		expect(shares).toEqual({ myBabNumbers: [1], poolBabNumbers: [3, 4], readBabNumbers: [2, 4] });
		expect(portionOwnership(1, shares)).toBe('mine');
		expect(portionOwnership(2, shares)).toBe('other');
		expect(portionOwnership(3, shares)).toBe('pool');
	});

	it('owns nothing in a closed round without a viewer to own it', () => {
		const round = {
			babs: [
				{
					isPool: false,
					number: 1,
					owedByUserId: ME,
					owedBySlotIndex: 0,
					readAt: null,
					readByUserId: null
				}
			]
		};

		expect(pastRoundShares(round, null).myBabNumbers).toEqual([]);
	});
});

describe('stepHizbPage', () => {
	// Portion 1 has two blocks, 2 has three, 3 has one.
	const blockCounts: Record<number, number> = { 1: 2, 2: 3, 3: 1 };
	const blockCountOf = (partNumber: number) => blockCounts[partNumber] ?? 0;

	it('walks the blocks of a portion', () => {
		expect(stepHizbPage({ blockIndex: 0, partNumber: 2 }, 1, 3, blockCountOf)).toEqual({
			blockIndex: 1,
			partNumber: 2
		});
		expect(stepHizbPage({ blockIndex: 2, partNumber: 2 }, -1, 3, blockCountOf)).toEqual({
			blockIndex: 1,
			partNumber: 2
		});
	});

	it('opens the next portion at its first block', () => {
		expect(stepHizbPage({ blockIndex: 1, partNumber: 1 }, 1, 3, blockCountOf)).toEqual({
			blockIndex: 0,
			partNumber: 2
		});
	});

	it('opens the previous portion at its last block', () => {
		expect(stepHizbPage({ blockIndex: 0, partNumber: 3 }, -1, 3, blockCountOf)).toEqual({
			blockIndex: 2,
			partNumber: 2
		});
	});

	it('stops at either end of the book', () => {
		expect(stepHizbPage({ blockIndex: 0, partNumber: 1 }, -1, 3, blockCountOf)).toBeUndefined();
		expect(stepHizbPage({ blockIndex: 0, partNumber: 3 }, 1, 3, blockCountOf)).toBeUndefined();
	});
});

describe('markFailureKind', () => {
	it('says a contested claim or gap was taken', () => {
		expect(markFailureKind(409, { isRepeated: false, step: 'take' })).toBe('taken');
		expect(markFailureKind(409, { isRepeated: true, step: 'take' })).toBe('taken');
		expect(markFailureKind(409, { isRepeated: false, step: 'cover' })).toBe('taken');
	});

	it('blames the count for a repeated portion refused on marking', () => {
		expect(markFailureKind(409, { isRepeated: true, step: 'read' })).toBe('repetitions');
		expect(markFailureKind(409, { isRepeated: true, step: 'cover' })).toBe('repetitions');
	});

	it('calls everything else a failed save', () => {
		expect(markFailureKind(409, { isRepeated: false, step: 'read' })).toBe('failed');
		expect(markFailureKind(409, { isRepeated: true, step: 'count' })).toBe('failed');
		expect(markFailureKind(500, { isRepeated: true, step: 'read' })).toBe('failed');
		expect(markFailureKind(null, { isRepeated: false, step: 'cover' })).toBe('failed');
	});
});
