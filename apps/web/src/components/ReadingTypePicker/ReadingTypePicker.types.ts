import type { GroupKind } from '@/lib/types/domain';

export interface ReadingTypePickerProps {
	onChange: (kind: GroupKind) => void;
	value: GroupKind;
}
