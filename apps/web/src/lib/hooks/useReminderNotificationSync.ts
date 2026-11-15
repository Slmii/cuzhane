import { useGetGroups } from '@/lib/hooks/useGroup';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupSummary, UserSettings } from '@/lib/types/domain';
import {
	cancelReminders,
	getScheduledReminders,
	hasReminderPermission,
	readReminderKey,
	scheduleReminders
} from '@/lib/utils/notifications/reminderNotifications';
import { isSameReminderSet, type ReminderNotice } from '@/lib/utils/notifications/reminderSignatures';
import { plannedReminders, type ReminderBook } from '@/lib/utils/reminder';
import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Matches the server's own default, for the beat before settings arrive. */
const DEFAULT_REMINDER_TIME = '21:30';

type Translate = ReturnType<typeof useTranslation>['t'];

type DesiredState = {
	isReady: boolean;
	isSignedIn: boolean;
	settings: UserSettings | undefined;
	groups: GroupSummary[] | undefined;
	t: Translate;
};

/**
 * Every reminder that should be waiting on the device, worked out against the clock now: the
 * Cevşen's and the Hizb's, each at its own time, each only on days something is unread.
 */
const wantedReminders = ({ groups, isSignedIn, settings, t }: DesiredState, now: Date): ReminderNotice[] => {
	if (!isSignedIn || !settings) {
		return [];
	}

	const books: { book: ReminderBook; isOn: boolean; time: string }[] = [
		{ book: 'cevsen', isOn: settings.reminderEnabled, time: settings.reminderTime ?? DEFAULT_REMINDER_TIME },
		{
			book: 'hizb',
			isOn: settings.hizbReminderEnabled,
			time: settings.hizbReminderTime ?? DEFAULT_REMINDER_TIME
		}
	];

	return books
		.filter(entry => entry.isOn)
		.flatMap(({ book, time }) =>
			plannedReminders(groups, book, time, now).map(({ at, body }) => ({
				at,
				body: t(body.key, body.values),
				book,
				title: t('notifTitle')
			}))
		);
};

/**
 * Keeps what the OS has scheduled in step with what the reader asked for.
 *
 * A local notification outlives the process that scheduled it — that is what makes the
 * reminder survive a swipe-away — but nothing else does. The settings live on the server,
 * so on a fresh install, a new device, or a sign-in the OS knows nothing about them. This
 * reconciles the two every time the app becomes usable: on mount (hard reopen), whenever
 * the settings or the counts change, and on every return to the foreground (soft reopen).
 *
 * **Dated reminders for the days ahead, not one repeating one** (`plannedReminders`), so a day
 * with nothing unread has none. They are worked out at each reconcile, against the clock then —
 * which is also what moves the window on as the days pass.
 *
 * It compares the set it wants against the set the OS holds rather than rescheduling blindly.
 * Cancelling and re-adding on every launch would leave a window with nothing scheduled, and an
 * app opened at the moment a reminder was due would silently lose it.
 */
export const useReminderNotificationSync = () => {
	const { t } = useTranslation();
	const { isSignedIn } = useAuth();
	const { data: settings, isSuccess: hasSettings } = useGetUserSettings();
	const { data: groups, isSuccess: hasGroups } = useGetGroups();

	const isSyncing = useRef(false);
	const isRerunPending = useRef(false);

	/**
	 * Signed out is a known state, not an unknown one: the answer is "nothing scheduled",
	 * and it has to be acted on. Otherwise the previous account's reminder — carrying their
	 * group's name — keeps arriving on a signed-out device, because clearing the query cache
	 * leaves the settings query with no successful result to reconcile against.
	 *
	 * Signed in, both queries must have landed. Acting on settings alone would cancel a good
	 * notification during the moment before groups arrive, and a force-quit in that window
	 * would leave the reader with none at all.
	 */
	const isReady = isSignedIn === false || (isSignedIn === true && hasSettings && hasGroups);

	/**
	 * The inputs, kept in a ref so a run that is already under way finishes against the newest
	 * values rather than the ones it started with. Written in an effect, so it only ever reflects
	 * a committed render.
	 */
	const desired = useRef<DesiredState>({ groups, isReady, isSignedIn: isSignedIn === true, settings, t });

	useEffect(() => {
		desired.current = { groups, isReady, isSignedIn: isSignedIn === true, settings, t };
	}, [groups, isReady, isSignedIn, settings, t]);

	const reconcileOnce = useCallback(async () => {
		const state = desired.current;

		// Nothing is known yet — acting now would cancel perfectly good reminders on the strength
		// of data that simply hasn't arrived.
		if (!state.isReady) {
			return;
		}

		const wanted = wantedReminders(state, new Date());

		// Signed out, both switched off, or nothing unread on any day ahead: nothing should be
		// waiting. Signing out matters most — a reminder must not keep arriving for whoever holds
		// the device next.
		if (wanted.length === 0) {
			await cancelReminders();
			return;
		}

		// Read, never request. Prompting from a reconciler that runs on every launch would
		// throw the system dialog at someone who only opened the app; the Reminders screen
		// asks when a switch is turned on, which is the moment it means something.
		if (!(await hasReminderPermission())) {
			return;
		}

		const scheduled = await getScheduledReminders();

		if (isSameReminderSet(scheduled.map(readReminderKey), wanted)) {
			return;
		}

		// Anything else — a changed count, time or day, an older build's repeating reminder, or
		// duplicates left by a crash mid-sync — is settled by rebuilding from one known state.
		await cancelReminders();
		await scheduleReminders(wanted);
	}, []);

	/**
	 * Runs are serialised, never dropped. The old guard returned early while a sync was in
	 * flight, so a settings change landing mid-run was lost until the next foreground — and
	 * on a cold start, where settings and groups resolve moments apart, that routinely meant
	 * the first run cancelled (no group yet) and the second was discarded, leaving nothing
	 * scheduled at all. Now a request arriving mid-run marks the loop to go round again.
	 */
	const syncNow = useCallback(async () => {
		if (isSyncing.current) {
			isRerunPending.current = true;
			return;
		}

		isSyncing.current = true;

		try {
			do {
				isRerunPending.current = false;
				await reconcileOnce();
			} while (isRerunPending.current);
		} finally {
			isSyncing.current = false;
		}
	}, [reconcileOnce]);

	// Every committed change to the desired state asks for a reconcile; the ref above is
	// what makes an in-flight run pick the new values up.
	useEffect(() => {
		void syncNow();
	}, [groups, isReady, settings, syncNow, t]);

	// Soft reopen. A hard one is covered by the effect above, since the hook mounts again.
	useEffect(() => {
		const subscription = AppState.addEventListener('change', state => {
			if (state === 'active') {
				void syncNow();
			}
		});

		return () => subscription.remove();
	}, [syncNow]);

	return { syncNow };
};
