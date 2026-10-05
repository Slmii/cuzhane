/**
 * What the "Neler yeni" sheet should do on this launch (design P1).
 *
 * Split out of `useWhatsNew` because the rules are the hard part and the SecureStore plumbing is
 * not. Four of them, and they hold for every release rather than just the one that introduced
 * the feature:
 *
 * 1. A reader whose welcome is still to come gets the welcome first — `wait`.
 * 2. A hint's card on screen goes first too, and the sheet follows it — `wait`, then `show`.
 * 3. A reader who saw the welcome long ago gets the sheet straight away — `show`.
 * 4. Somebody opening the app for the first time gets the welcome and nothing else — `record`.
 *
 * `record` and `show` both store the version; they differ only in whether anything is displayed.
 * That is what keeps a newcomer from being shown the notes for the release they arrived on, while
 * still making them an ordinary reader — told about every release after it — from the next launch.
 */
export type WhatsNewDecision =
	/** Not yet: the welcome or a hint owns the screen, or the answer is not known. Nothing is recorded. */
	| 'wait'
	/** Mark this release as seen without showing it. */
	| 'record'
	/** Open the sheet, and mark the release as seen. */
	| 'show';

export type WhatsNewInput = {
	/**
	 * The welcome hint is still to come for this account. `undefined` while the hints are still
	 * in flight — not the same as `false`.
	 */
	isWelcomePending: boolean | undefined;
	/** A hint's card is on screen right now. */
	isHintShowing: boolean;
	/**
	 * Something else owns the screen — today, the animated splash. It is in here because this
	 * sheet is presented by UIKit above everything, splash included, so without it the notes
	 * appear over a screen the reader has not arrived at yet.
	 */
	isBlocked: boolean;
	/**
	 * Ana sayfa is the screen this is decided on, and **mounted is not the same as looked at**:
	 * the tabs are not lazy, so Home mounts on launch whatever tab the app opens onto — a scanned
	 * invite lands on Gruplarım with the join sheet open, and a second sheet in that frame is
	 * one iOS refuses to present. The loser vanishes silently, and the version has already been
	 * recorded, so the notes never come back.
	 */
	isFocused: boolean;
	/** This account came through onboarding during this launch — see `onboardingLaunch`. */
	isNewcomer: boolean;
	/** What this install last recorded, or `null` if it never has. */
	lastSeenReleaseId: string | null;
	/**
	 * The release this build announces — `RELEASES[0].id`, **not** the app version. A release
	 * that goes out over the air lands on the version already installed, so the version cannot
	 * say whether there is something new to show.
	 */
	currentReleaseId: string;
};

export const whatsNewDecision = ({
	currentReleaseId,
	isBlocked,
	isFocused,
	isHintShowing,
	isNewcomer,
	isWelcomePending,
	lastSeenReleaseId
}: WhatsNewInput): WhatsNewDecision => {
	if (isWelcomePending === undefined || isBlocked || !isFocused) {
		return 'wait';
	}

	/*
	 * A newcomer is settled before the welcome is looked at, and deliberately: theirs is about to
	 * show and would defer this for the whole of their first session, which is precisely the
	 * session the sheet must not appear in. Recording now also means the welcome ending does not
	 * then spring it on them.
	 */
	if (!isNewcomer && (isWelcomePending || isHintShowing)) {
		return 'wait';
	}

	if (lastSeenReleaseId === currentReleaseId) {
		return 'record';
	}

	return isNewcomer ? 'record' : 'show';
};

/**
 * **Where this build keeps the last release it announced — one key per channel.** Preview and the
 * store build are the same app to the phone, and the storage (iOS's keychain) outlives replacing
 * one with the other: a release seen on preview was already "seen" when the store build arrived,
 * so its sheet never opened. Production keeps the key it has always had, so nobody who already
 * saw a release in the store build is shown it again. `channel` is `BUILD_CHANNEL` — null in the
 * store build.
 */
export const whatsNewStorageKey = (channel: string | null) =>
	channel === null ? 'whatsNew.lastSeenReleaseId' : `whatsNew.lastSeenReleaseId.${channel}`;
