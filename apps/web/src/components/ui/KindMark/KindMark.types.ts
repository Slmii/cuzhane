import type { GroupKind } from '@/lib/types/domain';

export interface KindMarkProps {
	/** Which book's mark: the Cevşen's tesbih or the Hizb's eight-pointed star. */
	kind: GroupKind;
	/** Rendered edge length in points. The artwork is a 96×96 grid. The kind cards draw it at 48. */
	size?: number;
	/**
	 * What the Hizb star's ring and centre dot are painted in. They are cut *out* of the star, so
	 * this has to match whatever the mark sits on — `accentSoft` on a selected card, `surface` on
	 * an unselected one. Defaults to the page. The tesbih has no cut-out and ignores it.
	 */
	backgroundColor?: string;
}
