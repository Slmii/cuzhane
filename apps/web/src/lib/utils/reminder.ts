import type { StringKey } from '@/lib/i18n/strings';
import { isRepeatingCycle, type GroupSummary } from '@/lib/types/domain';

export type ReminderTotals = {
	/**
	 * Everything still owed today across every running group — babs and portions together, which
	 * is only a number worth printing once the copy stops calling it either (see `reminderBody`).
	 */
	unread: number;
	/** Of those, the Cevşen groups' babs. */
	unreadBabs: number;
	/** And the Hizb groups' portions — a different book's unit, so never added into the babs. */
	unreadPortions: number;
	/** How many of those groups still owe something — 0 when the day is done. */
	pendingGroups: number;
	/**
	 * Running groups the reader has a share in at all, finished or not. Zero means there is
	 * nothing to remind anybody about, which is a different thing from having finished.
	 */
	participatingGroups: number;
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
export const reminderTotals = (
	groups: GroupSummary[] | undefined,
	/** Which books' groups the reader is reminded about — each daily reminder has its own switch. */
	books: { cevsen: boolean; hizb: boolean } = { cevsen: true, hizb: true }
): ReminderTotals => {
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
	 *
	 * A Hizb group counts in portions (`unreadPortions`), and a personal-plan one by its
	 * `hizbToday` rather than a seat's share.
	 */
	const running = (groups ?? []).filter(
		group =>
			group.kind !== 'HATIM' &&
			(group.kind === 'HIZB' ? books.hizb : books.cevsen) &&
			group.status === 'RUNNING' &&
			(group.myBabNumbers.length > 0 || group.hizbToday != null)
	);

	return running.reduce<ReminderTotals>(
		(totals, group) => {
			// A Şahsi Cevşen day owes its babs, not the one reading.
			const outstanding = group.hizbToday
				? group.hizbToday.completed
					? 0
					: group.hizbToday.units?.length ?? 1
				: Math.max(0, group.myBabNumbers.length - group.myReadCount);
			const isHizb = group.kind === 'HIZB';

			return {
				participatingGroups: totals.participatingGroups + 1,
				pendingGroups: totals.pendingGroups + (outstanding > 0 ? 1 : 0),
				unread: totals.unread + outstanding,
				unreadBabs: totals.unreadBabs + (isHizb ? 0 : outstanding),
				unreadPortions: totals.unreadPortions + (isHizb ? outstanding : 0)
			};
		},
		{ participatingGroups: 0, pendingGroups: 0, unread: 0, unreadBabs: 0, unreadPortions: 0 }
	);
};

export type ReminderBody = { key: StringKey; values?: Record<string, number> };

/**
 * The reminder's sentence, chosen from the totals — the scheduler turns it into text, and the
 * text is what `contentSig` compares, so a change of wording replaces the pending notification.
 *
 * **Babs and portions are never summed under one noun.** Only babs keeps the Cevşen's lines;
 * only portions is their twin. Each has its own line for one — a Hizb seat often holds a single
 * portion, and a released pool block can leave a single bab — so English and Dutch never say
 * "1 portions". Owing both says "okuman", a reading, which is true of either. It is always the
 * several-groups line: a group reads one book, so owing both means at least one group of each.
 *
 * Past one group the count is named with the groups, because a bare total over several reads as
 * one group's. Nothing owed is still a nudge, since the next round opens before this fires again.
 */
export const reminderBody = ({ pendingGroups, unread, unreadBabs, unreadPortions }: ReminderTotals): ReminderBody => {
	if (unread === 0) {
		return { key: 'notifBodyIdle' };
	}

	if (unreadBabs > 0 && unreadPortions > 0) {
		return { key: 'notifBodyGroupsMixed', values: { groups: pendingGroups, unread } };
	}

	if (unreadPortions > 0) {
		return pendingGroups > 1
			? { key: 'notifBodyGroupsPortions', values: { groups: pendingGroups, unread } }
			: { key: unread === 1 ? 'notifBodyPortionsOne' : 'notifBodyPortions', values: { unread } };
	}

	// A single bab is real once a released pool block leaves one behind, so it has its own line too.
	return pendingGroups > 1
		? { key: 'notifBodyGroups', values: { groups: pendingGroups, unread } }
		: { key: unread === 1 ? 'notifBodyOne' : 'notifBody', values: { unread } };
};

/** A daily reminder's book: each has its own switch and its own time. */
export type ReminderBook = 'cevsen' | 'hizb';

/** One dated reminder, and what it says. */
export type PlannedReminder = { at: Date; body: ReminderBody };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far ahead reminders are written: the app replaces them every time it opens, so a reader who
 * stays away this long stops hearing until they come back. Thirty days for two books is 60 pending
 * notifications — under iOS's limit of 64, and the reminders are the only ones this app schedules.
 */
export const REMINDER_DAYS_AHEAD = 30;

/**
 * The reminders a book should send over the coming days — **only on a day something is unread**.
 *
 * A local notification is written in advance and cannot look at the shelf when it fires, so the
 * days are worked out now, from what each group owes and when its next reading opens (a plan's
 * `nextDayAt`, a seat group's `roundEndsAt`):
 *
 * - Before that moment the group owes what it owes now: nothing, once its share is read.
 * - From that moment a new reading has opened, which is owed — unless it is a plan day already
 *   read ahead, a flexible group (which hands out no share of its own), or a one-off that ended.
 *
 * A day whose reminder time finds nothing owed is left out. Today's says the actual count; a
 * later day's does not know it yet and says the share is waiting (`notifBodyIdle`).
 */
export const plannedReminders = (
	groups: GroupSummary[] | undefined,
	book: ReminderBook,
	time: string,
	now: Date,
	daysAhead = REMINDER_DAYS_AHEAD
): PlannedReminder[] => {
	const books = { cevsen: book === 'cevsen', hizb: book === 'hizb' };
	const participating = (groups ?? []).filter(group => reminderTotals([group], books).participatingGroups > 0);

	if (participating.length === 0) {
		return [];
	}

	const [hour = 0, minute = 0] = time.split(':').map(Number);
	const planned: PlannedReminder[] = [];

	for (let day = 0; day < daysAhead; day++) {
		const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute);

		if (at.getTime() <= now.getTime()) {
			continue;
		}

		// Whether each group owes something at `at`, and whether that is still today's known count.
		const owing = participating.flatMap((group): { group: GroupSummary; isSameReading: boolean }[] => {
			const nextOpensAt = group.nextDayAt ?? group.roundEndsAt;
			const isSameReading = nextOpensAt === null || at.getTime() < new Date(nextOpensAt).getTime();

			if (isSameReading) {
				return reminderTotals([group], books).unread > 0 ? [{ group, isSameReading }] : [];
			}

			// A plan's next days are owed — except those already read ahead, which follow today in order.
			if (group.hizbToday != null) {
				const dayAfterToday = Math.floor((at.getTime() - new Date(nextOpensAt).getTime()) / DAY_MS) + 1;

				return dayAfterToday > (group.hizbAheadDays ?? 0) ? [{ group, isSameReading }] : [];
			}

			// A repeating group's next round brings a new share. A flexible one hands out none — its
			// claims go with the round — and a one-off has ended.
			return group.splitMode !== 'FLEXIBLE' && isRepeatingCycle(group.cycle) ? [{ group, isSameReading }] : [];
		});

		if (owing.length === 0) {
			continue;
		}

		const body = owing.every(entry => entry.isSameReading)
			? reminderBody(
					reminderTotals(
						owing.map(entry => entry.group),
						books
					)
			  )
			: { key: 'notifBodyIdle' as const };

		planned.push({ at, body });
	}

	return planned;
};
