import type { GroupKind } from '@/lib/types/domain';

export interface ReadingTypeMarkProps {
	kind: GroupKind;
	/** Drawn size in points. The design ships it at 96, 48 and 24. */
	size: number;
	/** The mark's single colour. Defaults to the accent. */
	color?: string;
	/**
	 * The colour the mark is sitting on.
	 *
	 * The mushaf's spine and page rules are **knocked out** of a solid fill rather than drawn
	 * on top of it, so they have to be painted in the ground's own colour — the same rule
	 * `ui/Ornament` records for its centre disc. Wrong here, the book gets a stripe of the
	 * wrong colour down its middle. Defaults to the card surface.
	 */
	backgroundColor?: string;
}
