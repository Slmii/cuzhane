import type { GroupKind } from '@/lib/types/domain';

export interface HomeGroupRowProps {
	kind: GroupKind;
	name: string;
	/** "61–65" for a Cevşen share, "Cüz 7" for a hatim's. */
	heading: string;
	/** "2/5", or "0/20 s · 6 gün" for a cüz. */
	meta: string;
	/** Stretches of the share beyond the one in the heading, as a `SliceChip`; 0 draws none. */
	moreCount: number;
	/** Segments a bab for Cevşen; a single bar filled by pages for a cüz. */
	segments?: { total: number; filled: number };
	fraction?: number;
	/** "Devam" once begun, "Oku" before. */
	actionLabel: string;
	/** The button: straight into the reading (or the pick, for a row with nothing to read yet). */
	onPress: () => void;
	/** The row itself: the group's own screen. */
	onOpenGroup: () => void;
}
