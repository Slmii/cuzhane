export interface HomeGroupRowGroup {
	id: string;
	name: string;
	/** The stretch the reader is in, as `shareSlices` picks it — "43–47". */
	range: string;
	/** Ranges beyond that one, counted rather than spelled out. */
	moreCount: number;
	total: number;
	done: number;
}

export interface HomeGroupRowProps {
	group: HomeGroupRowGroup;
	/**
	 * Whether this row's button is the one the first-use tour puts its spotlight on. Set by the
	 * screen for the topmost row only — a stop points at one thing, not at nine.
	 */
	isTourTarget?: boolean;
	/** The row itself opens the group. */
	onPress: () => void;
	/** The button opens the reader, where the reader left off. */
	onOpenReader: () => void;
}
