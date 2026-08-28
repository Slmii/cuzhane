export type ReminderSchedule = {
	/** `HH:mm`, the reader's local wall clock. */
	time: string;
	isEnabled: boolean;
};

export type ReminderContent = {
	title: string;
	body: string;
};

/**
 * What the OS was asked for. Compared against what is actually scheduled so an app launch
 * only rebuilds a notification whose *trigger* changed — rescheduling on every launch
 * would leave a window with nothing scheduled, and an app opened at the moment the
 * reminder was due would silently lose that day's notification.
 */
export const buildTriggerSignature = ({ isEnabled, time }: ReminderSchedule) => JSON.stringify({ isEnabled, time });

/**
 * What it will say. Separate from the trigger because the wording changes far more often
 * than the time does — every bab read moves the count — and a content change can be
 * replaced without touching the schedule's identity.
 */
export const buildContentSignature = ({ body, title }: ReminderContent) => JSON.stringify({ body, title });
