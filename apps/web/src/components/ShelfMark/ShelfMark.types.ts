export type ShelfMarkProps = {
	/** The bars and the shelf. */
	color: string;
	/** The trailing columns — what hasn't been read yet. */
	dimColor: string;
	/** 1 is the splash's size; the mark scales as a whole. */
	scale?: number;
	shouldAnimate?: boolean;
};
