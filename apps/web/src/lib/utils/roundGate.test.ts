import { describe, expect, it } from 'vitest';
import { decideRoundGate, type RoundGateInput } from './roundGate';

/** A running hatim on round 3, joined long ago, holding cüz, with nothing left to show. */
const base: RoundGateInput = {
	boundaryPolicy: 'REPICK',
	hasSkippedRound: false,
	holdsCuz: true,
	isComplete: false,
	isHatim: true,
	isRunning: true,
	previousRoundComplete: false,
	roundIndex: 3,
	seen: { carried: false, complete: false, previousComplete: false },
	wasInPreviousRound: true
};

const decide = (overrides: Partial<RoundGateInput>) => decideRoundGate({ ...base, ...overrides });

/** The scenario table agreed for Q7 and QR1, row by row. */
describe('which screen a hatim group opens on', () => {
	it('opens a Cevşen group, or a hatim still gathering, as it always did', () => {
		expect(decide({ isHatim: false, holdsCuz: false })).toEqual({ kind: 'open' });
		expect(decide({ isRunning: false, holdsCuz: false })).toEqual({ kind: 'open' });
	});

	it('1 — a round in progress, not complete: the group', () => {
		expect(decide({})).toEqual({ kind: 'open' });
	});

	it('2 and 3 — complete this round: Q7 once, then the group', () => {
		expect(decide({ isComplete: true })).toEqual({ kind: 'complete', roundIndex: 3 });
		expect(decide({ isComplete: true, seen: { ...base.seen, complete: true } })).toEqual({ kind: 'open' });
	});

	it('4, 6 and 7 — holding no cüz: QR1 must be answered, every time', () => {
		expect(decide({ holdsCuz: false })).toEqual({ kind: 'roundStart', reason: 'pick' });
		expect(decide({ boundaryPolicy: 'KEEP', holdsCuz: false })).toEqual({ kind: 'roundStart', reason: 'pick' });
		// Not a once-a-round screen: having been shown it changes nothing.
		expect(decide({ holdsCuz: false, seen: { carried: true, complete: true, previousComplete: true } })).toEqual({
			kind: 'roundStart',
			reason: 'pick'
		});
	});

	it('skipping the round is the one way in without a cüz', () => {
		expect(decide({ hasSkippedRound: true, holdsCuz: false })).toEqual({ kind: 'open' });
	});

	it('5 — cüz carried over under "Cüzler korunur": QR1 as a note, once', () => {
		expect(decide({ boundaryPolicy: 'KEEP' })).toEqual({ kind: 'roundStart', reason: 'carried' });
		expect(decide({ boundaryPolicy: 'KEEP', seen: { ...base.seen, carried: true } })).toEqual({ kind: 'open' });
	});

	it('shows no carried note on the first round, or to someone who joined this round', () => {
		expect(decide({ boundaryPolicy: 'KEEP', roundIndex: 0 })).toEqual({ kind: 'open' });
		expect(decide({ boundaryPolicy: 'KEEP', wasInPreviousRound: false })).toEqual({ kind: 'open' });
	});

	it('10 — last round completed but only seen now: Q7 first, then QR1', () => {
		expect(decide({ holdsCuz: false, previousRoundComplete: true })).toEqual({
			kind: 'complete',
			roundIndex: 2,
			then: 'pick'
		});
		expect(decide({ boundaryPolicy: 'KEEP', previousRoundComplete: true })).toEqual({
			kind: 'complete',
			roundIndex: 2,
			then: 'carried'
		});
		// Nothing after it: the celebration alone.
		expect(decide({ previousRoundComplete: true })).toEqual({ kind: 'complete', roundIndex: 2 });
	});

	it('does not celebrate a round the member was not part of, or one already seen', () => {
		expect(decide({ previousRoundComplete: true, wasInPreviousRound: false })).toEqual({ kind: 'open' });
		expect(decide({ previousRoundComplete: true, seen: { ...base.seen, previousComplete: true } })).toEqual({
			kind: 'open'
		});
	});
});
