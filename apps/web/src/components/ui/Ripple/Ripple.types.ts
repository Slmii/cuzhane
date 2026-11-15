export type RippleProps = {
	/** The rings' colour — the glyph's or the disc's accent. */
	color: string;
	/** A ring's size as it starts, centred on whatever it sits behind. */
	size: number;
	/** How large a ring grows before it is gone — keep `size × maxScale` inside the space it has. */
	maxScale: number;
};
