import type { GroupSummary } from '@/lib/types/domain';

export type ReminderTotals = {
	/** Babs still owed today, summed across every running group. */
	unread: number;
	/** How many of those groups still owe something — 0 when the day is done. */
	pendingGroups: number;
	/**
	 * Running groups the reader has a share in at all, finished or not. Zero means there is
	 * nothing to remind anybody about, which is a different thing from having finished.
	 */
	participatingGroups: number;
};

/**
 * Whether a `HH:mm` reminder first arrives tomorrow rather than today.
 *
 * The OS repeats a daily reminder by matching hour and minute against the next date
 * *strictly after* now, so a time that has already been reached today is scheduled for
 * tomorrow. Nothing about that is visible — a reader who sets 09:29 at 09:29 sees a
 * reminder that never comes and reasonably calls it broken.
 *
 * Equal counts as tomorrow: the write is debounced and round-trips the server, so by the
 * time the OS is told, the minute has always ticked past.
 */
export const isNextReminderTomorrow = (time: string, now: Date) => {
	const [hour, minute] = time.split(':').map(Number);
	const minutesOfDay = (hour || 0) * 60 + (minute || 0);

	return minutesOfDay <= now.getHours() * 60 + now.getMinutes();
};

/**
 * What the daily reminder is about: the whole day, not one group.
 *
 * Shared by the scheduler and the Reminders screen's preview, so what the preview shows is
 * the notification that will actually arrive rather than an illustration of one. They used
 * to compute this separately, which is exactly how the two drift apart.
 *
 * A group with no share today is not "done", it is not participating — it never counts.
 */
export const reminderTotals = (groups: GroupSummary[] | undefined): ReminderTotals => {
	const running = (groups ?? []).filter(group => group.status === 'RUNNING' && group.myBabNumbers.length > 0);

	return running.reduce<ReminderTotals>(
		(totals, group) => {
			const outstanding = Math.max(0, group.myBabNumbers.length - group.myReadCount);

			return {
				participatingGroups: totals.participatingGroups + 1,
				pendingGroups: totals.pendingGroups + (outstanding > 0 ? 1 : 0),
				unread: totals.unread + outstanding
			};
		},
		{ participatingGroups: 0, pendingGroups: 0, unread: 0 }
	);
};
