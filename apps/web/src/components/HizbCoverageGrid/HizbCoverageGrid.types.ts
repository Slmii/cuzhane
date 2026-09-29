import type { HizbBoardCell } from '@/lib/utils/groups';

export interface HizbCoverageGridProps {
	/** The 33, in order — `planBoardCells`. Hold its identity with `useMemo`: the cells are memoised. */
	cells: HizbBoardCell[];
	/** Drawn on the green "group done" band (W3): white tiles with the accent numeral. */
	isOnBand?: boolean;
}
