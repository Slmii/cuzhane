import { useIsTourDemo } from '@/components/Tour/Tour.context';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import {
	cancelReminders,
	getScheduledReminders,
	hasReminderPermission,
	readSignatures,
	scheduleReminder
} from '@/lib/utils/notifications/reminderNotifications';
import {
	buildContentSignature,
	buildTriggerSignature,
	type ReminderContent,
	type ReminderSchedule
} from '@/lib/utils/notifications/reminderSignatures';
import { reminderBody, reminderTotals } from '@/lib/utils/reminder';
import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

/** Matches the server's own default, for the beat before settings arrive. */
const DEFAULT_REMINDER_TIME = '21:30';

type DesiredState = {
	content: ReminderContent | null;
	isReady: boolean;
	schedule: ReminderSchedule;
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
 * It compares signatures rather than rescheduling blindly. Cancelling and re-adding on
 * every launch would leave a window with nothing scheduled, and an app opened at the
 * moment the reminder was due would silently lose that day's notification.
 */
export const useReminderNotificationSync = () => {
	const { t } = useTranslation();
	const { isSignedIn } = useAuth();
	const { data: settings, isSuccess: hasSettings } = useGetUserSettings();
	const { data: groups, isSuccess: hasGroups } = useGetGroups();
	const isTourRunning = useIsTourDemo();

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
	 *
	 * **And the tour is another unknown answer.** `useGetGroups` hands back the three stand-in
	 * groups while the walkthrough runs (see `useIsTourDemo`), and `contentSig` carries the bab
	 * count — so reconciling here would cancel the reader's real reminder and re-add one about
	 * groups they are not in, then swap it back a minute later. Quitting the app mid-tour would
	 * leave the demo one standing. Waiting is free: `isActive` is a dependency, so the run
	 * happens the moment the tour ends, with the real shelf.
	 */
	const isReady = isSignedIn === false || (isSignedIn === true && hasSettings && hasGroups && !isTourRunning);

	const schedule = useMemo<ReminderSchedule>(
		() => ({
			// The Reminders toggle, and nothing else — it is the only notification switch the
			// app has, and now the only one stored. See `user.prisma` for why.
			isEnabled: isSignedIn === true && !!settings?.reminderEnabled,
			time: settings?.reminderTime ?? DEFAULT_REMINDER_TIME
		}),
		[isSignedIn, settings?.reminderEnabled, settings?.reminderTime]
	);

	/**
	 * One line for the whole day, across every running group — the same total the home ring
	 * shows as "Bugünün tamamı". Naming a single group meant picking one arbitrarily out of
	 * six and reporting a fraction of what was actually owed.
	 *
	 * The count is a snapshot taken now: a local notification's text is fixed when it is
	 * scheduled, and nothing can recompute it at 21:30. Putting it in the content signature
	 * is what keeps it honest — reading a bab re-syncs and replaces the pending notification.
	 */
	const content = useMemo<ReminderContent | null>(() => {
		const totals = reminderTotals(groups);

		// Nothing to be reminded about is not the same as having finished — no notification
		// at all, rather than one saying the day is done.
		if (totals.participatingGroups === 0) {
			return null;
		}

		/*
		 * Which sentence — babs, portions, both, several groups or none owed — is `reminderBody`'s,
		 * and tested there. Its text lands in `contentSig`, so a change of wording, like a change of
		 * count, replaces the pending notification rather than leaving yesterday's standing.
		 */
		const body = reminderBody(totals);

		return { body: t(body.key, body.values), title: t('notifTitle') };
	}, [groups, t]);

	/**
	 * The desired state, kept in a ref so a run that is already under way finishes against
	 * the newest values rather than the ones it started with. Written in an effect, so it
	 * only ever reflects a committed render.
	 */
	const desired = useRef<DesiredState>({ content, isReady, schedule });

	useEffect(() => {
		desired.current = { content, isReady, schedule };
	}, [content, isReady, schedule]);

	const reconcileOnce = useCallback(async () => {
		const { content: wanted, isReady: canAct, schedule: wantedSchedule } = desired.current;

		// Nothing is known yet — acting now would cancel a perfectly good notification on the
		// strength of data that simply hasn't arrived.
		if (!canAct) {
			return;
		}

		// Signed out, switched off, or no running group to speak for: all mean "nothing
		// should be scheduled". Signing out matters most — the reminder carries a group name
		// and a count, and it must not keep arriving for whoever holds the device next.
		if (!wantedSchedule.isEnabled || !wanted) {
			await cancelReminders();
			return;
		}

		// Read, never request. Prompting from a reconciler that runs on every launch would
		// throw the system dialog at someone who only opened the app; the Reminders screen
		// asks when the switch is turned on, which is the moment it means something.
		if (!(await hasReminderPermission())) {
			return;
		}

		const scheduled = await getScheduledReminders();
		const triggerSig = buildTriggerSignature(wantedSchedule);
		const contentSig = buildContentSignature(wanted);

		const isCurrent =
			scheduled.length === 1 &&
			scheduled.every(notification => {
				const signatures = readSignatures(notification);

				return signatures.triggerSig === triggerSig && signatures.contentSig === contentSig;
			});

		if (isCurrent) {
			return;
		}

		// Anything else — a stale time, changed wording, or duplicates left by a crash
		// mid-sync — is settled by rebuilding from one known state.
		await cancelReminders();
		await scheduleReminder(wantedSchedule, wanted);
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
	}, [content, isReady, schedule, syncNow]);

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
