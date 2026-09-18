import type { AppNotification } from '@/lib/types/domain';

export interface NotificationRowProps {
	notification: AppNotification;
	/** Passed in rather than read here, so every row in a list ages against one clock. */
	now: Date;
}
