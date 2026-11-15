import type { CuzBoundaryPolicy } from '@/lib/types/domain';
import type { RoundStartReason } from '@/navigation/types';

/**
 * Which screen a hatim group opens on — the agreed scenario table for Q7 and QR1, as one pure
 * decision so it can be held by tests rather than by the order of a screen's effects.
 *
 * - **QR1 in pick mode is not optional.** A member of a running hatim who holds no cüz and has
 *   not skipped the round never sees the group: they choose cüz or sit the round out first. It
 *   is worked out from what they hold, never from a stored "seen", so nothing clears it.
 * - **QR1 in carried mode, and Q7, are once a round** — `seen` is the device's memory of that.
 * - **A completed round seen only after its boundary is still celebrated**, first, and the new
 *   round's screen follows it.
 */
export type RoundGateInput = {
	isHatim: boolean;
	isRunning: boolean;
	roundIndex: number;
	boundaryPolicy: CuzBoundaryPolicy | null;
	holdsCuz: boolean;
	hasSkippedRound: boolean;
	/** The round in progress has all thirty read. */
	isComplete: boolean;
	/** The round before this one had all thirty read. */
	previousRoundComplete: boolean;
	/** The member was already in the group when this round began. */
	wasInPreviousRound: boolean;
	seen: { complete: boolean; previousComplete: boolean; carried: boolean };
};

export type RoundGateDecision =
	| { kind: 'open' }
	| { kind: 'complete'; roundIndex: number; then?: RoundStartReason }
	| { kind: 'roundStart'; reason: RoundStartReason };

export const decideRoundGate = (input: RoundGateInput): RoundGateDecision => {
	if (!input.isHatim || !input.isRunning) {
		return { kind: 'open' };
	}

	const mustPick = !input.holdsCuz && !input.hasSkippedRound;
	const isNewRoundForMember = input.roundIndex > 0 && input.wasInPreviousRound;
	const showsCarried =
		!mustPick && input.holdsCuz && input.boundaryPolicy === 'KEEP' && isNewRoundForMember && !input.seen.carried;
	const roundStart: RoundStartReason | null = mustPick ? 'pick' : showsCarried ? 'carried' : null;

	if (isNewRoundForMember && input.previousRoundComplete && !input.seen.previousComplete) {
		return roundStart === null
			? { kind: 'complete', roundIndex: input.roundIndex - 1 }
			: { kind: 'complete', roundIndex: input.roundIndex - 1, then: roundStart };
	}

	if (roundStart !== null) {
		return { kind: 'roundStart', reason: roundStart };
	}

	if (input.isComplete && !input.seen.complete) {
		return { kind: 'complete', roundIndex: input.roundIndex };
	}

	return { kind: 'open' };
};
