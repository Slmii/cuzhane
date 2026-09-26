import type { GroupKind } from '@/lib/types/domain';

export interface LeaveGroupButtonProps {
	groupId: string;
	/** What goes back to the pool on leaving, in the dialog: unread babs, or cüz. */
	kind: GroupKind;
}
