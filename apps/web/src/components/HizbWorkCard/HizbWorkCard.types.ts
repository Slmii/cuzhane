import type { HizbWorkKey } from '@/lib/content/hizbPortions';
import type { HizbIndexWork } from '@/lib/utils/hizbIndex';

export interface HizbWorkCardProps {
	/** One entry of `hizbIndexWorks`. Hold its identity with `useMemo`: the card is memoised. */
	entry: HizbIndexWork;
	isOpen: boolean;
	/** The header's tap. Stable, so opening one card re-renders only the two that change. */
	onToggle: (key: HizbWorkKey) => void;
	/** A row's tap — the reader, on that portion. */
	onOpenPart: (partNumber: number) => void;
}
