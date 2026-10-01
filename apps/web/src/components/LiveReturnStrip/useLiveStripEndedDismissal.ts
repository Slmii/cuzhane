import { liveSession } from '@/lib/live/liveSession';
import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { hasLiveStrip, liveReaderRouteFor } from './liveReturnStrip';
import { liveReturnSlot } from './liveReturnSlot';

/** How long an ended strip stays if nothing else puts it away first. */
const ENDED_SHOWN_MS = 10_000;

/**
 * **"Bitti" is said once.** The ended strip goes with "Tamam", with the first screen change after
 * it appeared, or after ten seconds — whichever comes first — and going puts the session away.
 *
 * Called once, above every tab, with the screen the app is showing: each tab draws its own strip,
 * so the strips alone could not tell a tab switch (a screen change) from their own remount. The
 * clock starts when the ended strip is first on view, not when the session ended — a session that
 * ended under its own reader says so there, and the strip says it once the reader is left.
 */
export const useLiveStripEndedDismissal = (screenKey: string | undefined, screenName: string | undefined) => {
	const session = useLiveSessionState();
	const isEnded = hasLiveStrip(session) && session.gone !== null;
	const isOnReader = session !== null && screenName === liveReaderRouteFor(session.kind);
	// The strip hides under the keyboard; it has not been seen until the keyboard goes.
	const isKeyboardVisible = useKeyboardState(state => state.isVisible);
	// Due where it can actually be seen: the focused tab says so (not the reader, not a screen that
	// hides it, not with the tabs covered).
	const isDueShown = useSyncExternalStore(liveReturnSlot.subscribe, () => liveReturnSlot.get().isDue);
	const viewKey = isEnded && !isOnReader && !isKeyboardVisible && isDueShown ? screenKey ?? '' : null;
	// The screen the ended strip first appeared on.
	const [shownOn, setShownOn] = useState<string | null>(null);

	// Adjusted during render rather than from an effect — the React-sanctioned shape.
	if (!isEnded && shownOn !== null) {
		setShownOn(null);
	} else if (viewKey !== null && shownOn === null) {
		setShownOn(viewKey);
	}

	useEffect(() => {
		if (shownOn !== null && (screenKey ?? '') !== shownOn) {
			liveSession.leave();
		}
	}, [screenKey, shownOn]);

	useEffect(() => {
		if (shownOn === null) {
			return;
		}

		const timer = setTimeout(() => liveSession.leave(), ENDED_SHOWN_MS);

		return () => clearTimeout(timer);
	}, [shownOn]);
};
