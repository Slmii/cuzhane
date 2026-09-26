import type { GroupKind } from '@/lib/types/domain';
import type { StyleProp, ViewStyle } from 'react-native';

export interface BabLegendProps {
	/** A hatim's board has four states; a Cevşen group's has five. Defaults to Cevşen. */
	kind?: GroupKind;
	style?: StyleProp<ViewStyle>;
}
