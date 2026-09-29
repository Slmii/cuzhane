import type { GroupKind } from '@/lib/types/domain';
import type { StyleProp, ViewStyle } from 'react-native';

export interface FormKindOptionGroupProps {
	name: string;
	/**
	 * Runs after the field has taken the new kind, and only when the kind actually changed — a
	 * tap on the card that is already chosen is not a change. The create sheet resets the
	 * kind's dependent fields from here.
	 */
	onChange?: (kind: GroupKind) => void;
	error?: string;
	style?: StyleProp<ViewStyle>;
}
