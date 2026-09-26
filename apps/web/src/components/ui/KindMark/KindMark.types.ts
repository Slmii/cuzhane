import type { GroupKind } from '@/lib/types/domain';

export interface KindMarkProps {
	/** Which book's mark: the Cevşen's tesbih or the Hizb's eight-pointed star. */
	kind: GroupKind;
	/** Rendered edge length in points. The artwork is a 96×96 grid. The kind cards draw it at 48. */
	size?: number;
}
