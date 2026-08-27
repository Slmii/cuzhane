import type { SharedValue } from 'react-native-reanimated';

export interface DockRingGroup {
	id: string;
	name: string;
	/** The member's range for this round, already formatted ("31–35"). */
	range: string;
	total: number;
	done: number;
	/** Where the row's "Oku" opens. Null once the share is done. */
	nextBabNumber: number | null;
}

export interface DockRingProps {
	/** The group the ring is bound to. Selecting a row rebinds it; it never commits. */
	group: DockRingGroup;
	/** Scroll offset of the column underneath, in points. */
	scrollY: SharedValue<number>;
	/** Width available to the dock — the scroller's content width. */
	width: number;
	/** Distance from the top of the screen to the top of the scroll viewport. */
	topInset: number;
	/** The column's side padding — the dock's coordinates are the column's, not the screen's. */
	horizontalInset: number;
	/** Right-hand chip in the hero row, e.g. "36/100". */
	totalToday: string;
	isCommitting?: boolean;
	onCommit: (group: DockRingGroup) => void;
}
