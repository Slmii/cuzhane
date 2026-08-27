import type { GroupSplitMode } from '@/lib/types/domain';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PlanPreviewProps {
	/** Which plan to illustrate. ROTATION shows the first few days, FIXED a single row. */
	splitMode: GroupSplitMode;
	spots: number;
	/** The seat to preview. The create wizard previews seat 0 — the creator's. */
	slotIndex?: number;
	style?: StyleProp<ViewStyle>;
}
