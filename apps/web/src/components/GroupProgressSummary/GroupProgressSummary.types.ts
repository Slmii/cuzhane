import type { StyleProp, ViewStyle } from 'react-native';

export interface GroupProgressSummaryProps {
	readCount: number;
	/** What `readCount` is out of — the group's part count, or its seats on a lobby card. */
	total: number;
	/** The noun after the total, already translated: "bab", "bölüm", "katıldı". */
	unit: string;
	percent: number;
	style?: StyleProp<ViewStyle>;
}
