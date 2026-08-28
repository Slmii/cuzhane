import type { BabCellState } from '@/components/BabGrid/BabGrid.types';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import type { StringKey } from '@/lib/i18n/strings';
import type { GroupBab, GroupCycle, GroupSplitMode, GroupVisibility } from '@/lib/types/domain';
import { BAB_COUNT, babRuns, formatRun } from '@/lib/utils/babs';

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

/**
 * The gap between one cell lighting up and the next.
 *
 * `pool-fill.html` sets `--fill-step` at 70ms; this runs it quicker on request. A 13-bab
 * block is twelve of these before its last cell even starts, so the step is what decides
 * whether a claim feels like a sweep or like waiting for one.
 */
export const FILL_STEP_MS = 50;

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
export const staggerWithinRuns = (
	runKeys: (string | number)[],
	stepMs = FILL_STEP_MS,
	/**
	 * Runs to sweep the other way — the last cell first, back toward the start.
	 *
	 * Undoing a claim drains the block exactly as it filled, reversed, which is what makes
	 * the two read as one action and its undo rather than as two separate fills. Same step,
	 * opposite direction.
	 */
	reversedKeys?: ReadonlySet<string | number>
): number[] => {
	const delays: number[] = [];
	let runStart = 0;

	runKeys.forEach((key, index) => {
		if (index === 0 || runKeys[index - 1] !== key) {
			runStart = index;
		}

		delays.push((index - runStart) * stepMs);
	});

	if (reversedKeys === undefined || reversedKeys.size === 0) {
		return delays;
	}

	// Flipping each reversed run in place keeps the run's own span — the last cell inherits
	// the delay the first would have had, so the block still finishes when it always did.
	let start = 0;

	runKeys.forEach((key, index) => {
		const isRunEnd = index === runKeys.length - 1 || runKeys[index + 1] !== key;

		if (!isRunEnd) {
			return;
		}

		if (reversedKeys.has(key)) {
			for (let offset = 0; offset <= (index - start) / 2; offset += 1) {
				const head = start + offset;
				const tail = index - offset;
				const swap = delays[head] as number;

				delays[head] = delays[tail] as number;
				delays[tail] = swap;
			}
		}

		start = index + 1;
	});

	return delays;
};

export type ShareSlices = {
	/** The stretch to put front and centre — the one holding the next bab still owed. */
	current: string;
	/** How many other stretches the reader holds. Zero for the ordinary single range. */
	moreCount: number;
};

/**
 * A share as design 01g states it: one slice large, and a count of the rest.
 *
 * Ranges stopped being a single stretch once the pool arrived — volunteering for a block
 * hands you a second, unconnected range, and a reader can end a round holding several. Set
 * out in full they run to "1–13, 27–39, 66–78", which wraps to three lines in the ring and
 * pushes the group screen's heading to double height while saying nothing about what to
 * read next.
 *
 * The slice shown is the one holding `nextBabNumber` — where the reader actually is, not
 * simply the lowest number they own. A finished share has no next bab and falls back to the
 * first, because by then the question is what they read, not what is left.
 */
export const shareSlices = (babNumbers: number[], nextBabNumber: number | null): ShareSlices => {
	const runs = babRuns(babNumbers);
	const found =
		nextBabNumber === null ? -1 : runs.findIndex(run => nextBabNumber >= run.start && nextBabNumber <= run.end);
	const current = runs[found === -1 ? 0 : found];

	return current === undefined
		? { current: '—', moreCount: 0 }
		: { current: formatRun(current), moreCount: runs.length - 1 };
};

/** Placeholder board for the loading state so the card doesn't jump when data lands. */
export const emptyBabCells = () =>
	Array.from({ length: BAB_COUNT }, (_, index) => ({ number: index + 1, state: 'open' as BabCellState }));
