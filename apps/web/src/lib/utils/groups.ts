import type { BabCellState } from '@/components/BabGrid/BabGrid.types';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import type { StringKey } from '@/lib/i18n/strings';
import type { GroupBab, GroupCycle, GroupSplitMode, GroupVisibility } from '@/lib/types/domain';
import { BAB_COUNT } from '@/lib/utils/babs';

export const CYCLE_OPTIONS: GroupCycle[] = ['DAILY', 'WEEKLY'];

export const cycleLabelKey = (cycle: GroupCycle): StringKey => (cycle === 'DAILY' ? 'daily' : 'weekly');

export const visibilityLabelKey = (visibility: GroupVisibility): StringKey =>
	visibility === 'OPEN' ? 'open' : 'private';

export const visibilityChipTone = (visibility: GroupVisibility): ChipTone =>
	visibility === 'OPEN' ? 'accent' : 'sand';

/** The long form, for a card subtitle: "Sabit paylaşım". */
export const splitModeLabelKey = (splitMode: GroupSplitMode): StringKey =>
	splitMode === 'FIXED' ? 'fixedSplit' : 'planRotation';

/** The short form used wherever the plan sits inline beside a range. */
export const planLabelKey = (splitMode: GroupSplitMode): StringKey =>
	splitMode === 'FIXED' ? 'planFixed' : 'planRotation';

export type BabCellContext = {
	viewerUserId: string | null;
	/** The viewer's share this round (rotated share + anything they volunteered for). */
	myBabNumbers: Set<number>;
	/** Babs nobody is reading this round and nobody has volunteered for. */
	poolBabNumbers: Set<number>;
};

/**
 * Collapses a bab's read state and this round's share into the tones the board uses.
 *
 * `assignedUserId` no longer means "owns this seat's block" — it only records a pool
 * volunteer for the current round, and who reads which block is otherwise derived from
 * seat + round and never stored. So this reads the derived share the server already
 * computed (`myBabNumbers` / `poolBabNumbers`) instead of the raw assignment field.
 */
export const babCellState = (bab: GroupBab, context: BabCellContext): BabCellState => {
	const { viewerUserId, myBabNumbers, poolBabNumbers } = context;
	const isRead = bab.readAt !== null;

	if (isRead) {
		return viewerUserId !== null && bab.readByUserId === viewerUserId ? 'readByMe' : 'readByOthers';
	}

	if (myBabNumbers.has(bab.number)) {
		return 'mineUnread';
	}

	if (poolBabNumbers.has(bab.number)) {
		return 'pool';
	}

	return 'takenByOthers';
};

export const toBabCells = (
	babs: GroupBab[],
	context: { viewerUserId: string | null; myBabNumbers: number[]; poolBabNumbers: number[] }
) => {
	const cellContext: BabCellContext = {
		viewerUserId: context.viewerUserId,
		myBabNumbers: new Set(context.myBabNumbers),
		poolBabNumbers: new Set(context.poolBabNumbers)
	};

	return babs.map(bab => ({ number: bab.number, state: babCellState(bab, cellContext) }));
};

/** A pool bab, by whether anyone has volunteered for it — the three states the Havuz screen shows. */
export type PoolCellState = 'open' | 'takenByMe' | 'takenByOthers';

export type PoolCell = {
	number: number;
	state: PoolCellState;
	/**
	 * Which pool slot this bab belongs to. Optional because it exists only to time the
	 * üstlen sweep: the fill is staggered by a cell's position *inside its own block*, so
	 * claiming babs 27–39 sweeps those thirteen and leaves the rest of the pool alone.
	 * Without it every cell would be timed from the start of the whole pool and a late
	 * block would still be filling seconds after the tap.
	 */
	slotIndex?: number;
};

/**
 * The whole pool, claimed parts included — what the Havuz card draws.
 *
 * Membership comes from `poolAllBabNumbers`, which the server derives from the empty seats,
 * and never from `assignedUserId`. Inferring it — "a bab with a claim on it is a pool bab" —
 * held only while a claim could not outlive its seat being empty, and a claim stranded on a
 * seat somebody has since joined put babs on this card that the Havuz screen correctly left
 * out. One pool, two boards, thirteen babs apart.
 *
 * `GroupSummary.poolBabNumbers` is a different list: only the part nobody has taken, because
 * the 100-bab board needs it that way — a block someone volunteered for is that person's
 * work now, not an offer, so it must not keep wearing the hatch there.
 */
export const toPoolCells = (
	babs: GroupBab[],
	context: { viewerUserId: string | null; poolAllBabNumbers: number[] }
): PoolCell[] => {
	const poolNumbers = new Set(context.poolAllBabNumbers);

	return babs
		.flatMap<PoolCell>(bab => {
			if (!poolNumbers.has(bab.number)) {
				return [];
			}

			if (bab.assignedUserId === null) {
				return [{ number: bab.number, state: 'open' }];
			}

			const isMine = context.viewerUserId !== null && bab.assignedUserId === context.viewerUserId;

			return [{ number: bab.number, state: isMine ? 'takenByMe' : 'takenByOthers' }];
		})
		.sort((a, b) => a.number - b.number);
};

/** `pool-fill.html`'s `--fill-step`: the gap between one cell lighting up and the next. */
export const FILL_STEP_MS = 70;

/**
 * Per-cell delays that sweep each *run* of a grid left to right.
 *
 * `pool-fill.html` stages the üstlen fill by a cell's index inside the block being claimed,
 * not inside the whole grid — claiming babs 27–39 has to repaint those thirteen and leave
 * the rest alone. Timed from the start of the grid instead, a late block would still be
 * filling seconds after the tap.
 *
 * Callers pass whatever identifies a block: the slot index where it is known, otherwise the
 * cell's state, since a block is always claimed whole and therefore shares one state.
 * Cells whose colour did not change transition to the value they already hold, so a delay
 * on them costs nothing.
 */
export const staggerWithinRuns = (runKeys: (string | number)[], stepMs = FILL_STEP_MS): number[] => {
	const delays: number[] = [];
	let runStart = 0;

	runKeys.forEach((key, index) => {
		if (index === 0 || runKeys[index - 1] !== key) {
			runStart = index;
		}

		delays.push((index - runStart) * stepMs);
	});

	return delays;
};

/** Placeholder board for the loading state so the card doesn't jump when data lands. */
export const emptyBabCells = () =>
	Array.from({ length: BAB_COUNT }, (_, index) => ({ number: index + 1, state: 'open' as BabCellState }));
