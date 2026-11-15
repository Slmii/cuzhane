import type { GroupKind } from '@/lib/types/domain';
import type { StyleProp, ViewStyle } from 'react-native';

export interface GroupProgressSummaryProps {
	/** What the group reads — decides both the denominator and the word after it. */
	kind: GroupKind;
	readCount: number;
	/**
	 * What `readCount` is out of — the group's part count by default (`unitCountFor(kind)`), or
	 * its seats on a lobby card.
	 */
	total?: number;
	/** The noun after the total, already translated: "bab", "cüz", "bölüm", "katıldı". Defaults to the kind's unit. */
	unit?: string;
	percent: number;
	style?: StyleProp<ViewStyle>;
}
