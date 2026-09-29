import type { GroupKind, GroupSplitMode } from '@/lib/types/domain';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PlanPreviewProps {
	/** Which plan to illustrate. ROTATION shows the first few days, FIXED a single row. */
	splitMode: GroupSplitMode;
	spots: number;
	/**
	 * Which book is being divided. It gives both the size of the whole (`partCountFor`) and the
	 * noun the caption counts it in — one prop, so the number and the unit cannot disagree.
	 */
	kind: GroupKind;
	/** The seat to preview. The create wizard previews seat 0 — the creator's. */
	slotIndex?: number;
	style?: StyleProp<ViewStyle>;
}
