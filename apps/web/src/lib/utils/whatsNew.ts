/**
 * What the "Neler yeni" sheet should do on this launch (design P1).
 *
 * Split out of `useWhatsNew` because the rules are the hard part and the SecureStore plumbing is
 * not. Four of them, and they hold for every release rather than just the one that introduced
 * the feature:
 *
 * 1. A reader who has not seen the tour gets the tour — `wait`.
 * 2. When that tour ends, the sheet follows it — `show`.
 * 3. A reader who saw the tour long ago gets the sheet straight away — `show`.
 * 4. Somebody opening the app for the first time gets the tour and nothing else — `record`.
 *
 * `record` and `show` both store the version; they differ only in whether anything is displayed.
 * That is what keeps a newcomer from being shown the notes for the release they arrived on, while
 * still making them an ordinary reader — told about every release after it — from the next launch.
 */
export type WhatsNewDecision =
	/** Not yet: the tour owns the screen, or the answer is not known. Nothing is recorded. */
	| 'wait'
	/** Mark this release as seen without showing it. */
	| 'record'
	/** Open the sheet, and mark the release as seen. */
	| 'show';

export type WhatsNewInput = {
	/** `undefined` while the settings query is still in flight — not the same as `false`. */
	hasSeenTour: boolean | undefined;
	/** The tour is on screen right now, closing card included. */
	isTourActive: boolean;
	/**
	 * Something else owns the screen — today, the animated splash. The tour context's own
	 * `isBlocked`, and it is in here for the reason that flag exists at all: this sheet is
	 * presented by UIKit above everything, splash included, so without it the notes appear over
	 * a screen the reader has not arrived at yet.
	 */
	isBlocked: boolean;
	/**
	 * Ana sayfa is the screen this is decided on, and **mounted is not the same as looked at**:
	 * the tabs are not lazy, so Home mounts on launch whatever tab the app opens onto.
	 * `useTourAutoStart` carries the same guard and its docblock names the case — a scanned
	 * invite lands on Gruplarım with the join sheet open, and a second sheet in that frame is
	 * one iOS refuses to present. The loser vanishes silently, and the version has already been
	 * recorded, so the notes never come back.
	 */
	isFocused: boolean;
	/** This account came through onboarding during this launch — see `onboardingLaunch`. */
	isNewcomer: boolean;
	/** What this install last recorded, or `null` if it never has. */
	lastSeenVersion: string | null;
	/**
	 * `null` when the build's manifest could not be read. Not a version to compare against, so
	 * nothing is announced and nothing is recorded — better a missing notice than one keyed to
	 * a number the app invented.
	 */
	currentVersion: string | null;
};

export const whatsNewDecision = ({
	currentVersion,
	hasSeenTour,
	isBlocked,
	isFocused,
	isNewcomer,
	isTourActive,
	lastSeenVersion
}: WhatsNewInput): WhatsNewDecision => {
	if (hasSeenTour === undefined || currentVersion === null || isBlocked || !isFocused) {
		return 'wait';
	}

	/*
	 * A newcomer is settled before the tour is looked at, and deliberately: theirs is about to
	 * run and would defer this for the whole of their first session, which is precisely the
	 * session the sheet must not appear in. Recording now also means the tour finishing does not
	 * then spring it on them.
	 */
	if (!isNewcomer && (!hasSeenTour || isTourActive)) {
		return 'wait';
	}

	if (lastSeenVersion === currentVersion) {
		return 'record';
	}

	return isNewcomer ? 'record' : 'show';
};
