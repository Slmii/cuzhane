import type { GroupKind } from '@/lib/types/domain';
import type { StyleProp, ViewStyle } from 'react-native';

export interface GroupProgressSummaryProps {
	/** What the group reads — decides both the denominator and the word after it. */
	kind: GroupKind;
	readCount: number;
	percent: number;
	style?: StyleProp<ViewStyle>;
}
