import type { GroupKind } from '@/lib/types/domain';

export interface LeaveGroupButtonProps {
	groupId: string;
	isFlexible?: boolean;
	isOwner?: boolean;
	/** A Hizb personal plan: nothing goes back to share — the plan stops and its history stays. */
	isPlan?: boolean;
	/** What goes back to the pool on leaving, in the dialog: unread babs, or cüz. */
	kind: GroupKind;
}
