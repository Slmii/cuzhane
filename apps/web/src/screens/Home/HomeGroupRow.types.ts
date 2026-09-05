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
	/** The row itself opens the group. */
	onPress: () => void;
	/** The button opens the reader, where the reader left off. */
	onOpenReader: () => void;
}
