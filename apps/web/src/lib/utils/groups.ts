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

/** Placeholder board for the loading state so the card doesn't jump when data lands. */
export const emptyBabCells = () =>
	Array.from({ length: BAB_COUNT }, (_, index) => ({ number: index + 1, state: 'open' as BabCellState }));
