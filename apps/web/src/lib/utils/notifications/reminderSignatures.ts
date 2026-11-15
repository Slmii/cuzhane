import type { ReminderBook } from '@/lib/utils/reminder';

/** One dated reminder as it is handed to the OS: its book, when, and what it says. */
export type ReminderNotice = {
	book: ReminderBook;
	at: Date;
	title: string;
	body: string;
};

/**
 * What one scheduled reminder is — book, moment and wording in one string, stamped into it. The
 * reconciler compares the set it wants against the set the OS holds by these, so an app launch
 * that finds them the same leaves everything alone, and any change — a read bab, a new time, a
 * switch, a new day — rebuilds the set from one known state.
 */
export const buildReminderKey = ({ at, body, book, title }: ReminderNotice) =>
	JSON.stringify({ at: at.toISOString(), body, book, title });

/** Whether the OS already holds exactly the reminders wanted — no more, no fewer, no other. */
export const isSameReminderSet = (scheduledKeys: (string | null)[], wanted: ReminderNotice[]) => {
	if (scheduledKeys.length !== wanted.length) {
		return false;
	}

	const held = [...scheduledKeys].sort();
	const asked = wanted.map(buildReminderKey).sort();

	return held.every((key, index) => key === asked[index]);
};
