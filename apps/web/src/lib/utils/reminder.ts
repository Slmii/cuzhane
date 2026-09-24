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
	/*
	 * **Hatim groups are deliberately left out.**
	 *
	 * They were never opted in — they simply fell in, because a hatim's `myBabNumbers` is the
	 * cüz that member holds and the arithmetic below happens to work on it. Two things were
	 * wrong with that: the body says "{unread} **babın** kaldı", so a hatim reader was told
	 * they owed babs; and in a mixed set the two were summed, making "5 babın kaldı" out of
	 * three babs and two cüz — a number counting nothing real.
	 *
	 * "Bugün" is also the wrong frame for a round that runs ten or thirty days. A reminder
	 * for a hatim wants its own copy and probably its own moment (near the round's end, which
	 * is a server push and there is no cron), so it waits for section Q8 rather than shipping
	 * as a daily nag with the wrong noun in it.
	 */
	const running = (groups ?? []).filter(
		group => group.kind !== 'HATIM' && group.status === 'RUNNING' && group.myBabNumbers.length > 0
	);

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
