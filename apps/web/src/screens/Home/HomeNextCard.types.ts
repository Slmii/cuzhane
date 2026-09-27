import type { GroupKind } from '@/lib/types/domain';

export interface HomeNextCardProps {
	kind: GroupKind;
	/** "Bab 21–23", "Cüz 7". */
	heading: string;
	/** "Şifa Hatmi · 3 bab", "Şifa Hatmi · 1/3 okundu", "Ramazan Hatmi · 4/20 s". */
	caption: string;
	/** "2 sa 30 dk kaldı" — absent when the group has no round end to count to. */
	deadline: string | null;
	/** The deadline falls today — the badge turns red. */
	isDueToday: boolean;
	/** Stretches of the share beyond the one in the heading, as a `SliceChip`; 0 draws none. */
	moreCount: number;
	segments?: { total: number; filled: number };
	fraction?: number;
	/** "Okumaya başla", or "Bab 22’den devam" once begun. */
	actionLabel: string;
	onPress: () => void;
}
