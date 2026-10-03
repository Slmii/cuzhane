import { useHintsContext } from '@/components/Hints/Hints.context';
import { useIsFocused } from '@react-navigation/native';
import { CURRENT_RELEASE } from '@/lib/content/releaseNotes';
import { BUILD_CHANNEL } from '@/lib/utils/appVersion';
import { didOnboardThisLaunch } from '@/lib/utils/onboardingLaunch';
import { whatsNewDecision, whatsNewStorageKey } from '@/lib/utils/whatsNew';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The last release whose notes this install has seen. On the device, like the theme and the
 * language — not on the account: "what's new" is about the app on *this* phone having changed,
 * and the same account on a phone still running the old build has not had that happen yet.
 * One per build channel, so preview and the store build each announce a release — see
 * `whatsNewStorageKey`.
 */
const STORAGE_KEY = whatsNewStorageKey(BUILD_CHANNEL);

/**
 * Whether to open the "Neler yeni" sheet (design P1), and how to close it.
 *
 * **The welcome always goes first, and the sheet waits for it** — and for any hint's card that is
 * up. Four rules, and they hold for every release rather than just the one that introduced this
 * file:
 *
 * 1. A reader whose welcome is still to come gets the welcome.
 * 2. When it (or any hint) is gone, the sheet follows.
 * 3. A reader who saw the welcome long ago gets the sheet straight away.
 * 4. Somebody opening the app for the first time gets the welcome and nothing else.
 *
 * **1 and 4 are the same state as far as stored data goes**: a brand-new account and an existing
 * reader who never saw the welcome both have it pending. `didOnboardThisLaunch` is the one thing
 * that tells them apart — a newcomer came through `OnboardingScreen`, an existing reader launched
 * into the tabs.
 *
 * So a newcomer's version is recorded at once and the sheet never opens for it: onboarding and
 * the welcome are their introduction, and a list of changes to an app they have never used is not
 * news. Everybody else has the check **deferred** rather than spent — nothing is recorded — until
 * the welcome is behind them and no card is on screen. A hint, for its part, never shows over the
 * open sheet (`HintsProvider`), so the two never collide.
 *
 * The version is recorded at the moment the sheet opens, so a release announces itself at most
 * once per install however the sheet is dismissed.
 */
export const useWhatsNew = () => {
	const [isVisible, setIsVisible] = useState(false);
	const { isShowing: isHintShowing, isSplashVisible: isBlocked, isWelcomePending } = useHintsContext();
	const isFocused = useIsFocused();
	// One *completed* check per launch. Set only when the answer is acted on, never when the
	// check is deferred — deferring has to leave a later run free to do the work.
	const hasChecked = useRef(false);

	useEffect(() => {
		// The release being announced, not the app version — see `Release.id`.
		const currentReleaseId = CURRENT_RELEASE.id;

		// `undefined` is not "no", it is *not yet known*. Acting on it would record the release
		// and swallow the announcement, and the answer is a request away.
		if (isWelcomePending === undefined || hasChecked.current) {
			return;
		}

		const isNewcomer = didOnboardThisLaunch();
		const shared = { currentReleaseId, isBlocked, isFocused, isHintShowing, isNewcomer, isWelcomePending };

		// The welcome or a hint owns the screen until it is gone. Decided before the storage is
		// touched, so a deferred launch records nothing and leaves a later run free to act.
		if (whatsNewDecision({ ...shared, lastSeenReleaseId: null }) === 'wait') {
			return;
		}

		hasChecked.current = true;
		let isActive = true;

		const check = async () => {
			try {
				const lastSeenReleaseId = await SecureStore.getItemAsync(STORAGE_KEY);
				const decision = whatsNewDecision({ ...shared, lastSeenReleaseId });

				if (lastSeenReleaseId !== currentReleaseId) {
					await SecureStore.setItemAsync(STORAGE_KEY, currentReleaseId);
				}

				if (isActive && decision === 'show') {
					setIsVisible(true);
				}
			} catch {
				// No sheet. It is an announcement, not a feature.
			}
		};

		void check();

		return () => {
			isActive = false;
		};
	}, [isBlocked, isFocused, isHintShowing, isWelcomePending]);

	/*
	 * The version is already stored by the time the sheet opens, so dismissing is only a state
	 * change — closing the app instead of tapping "Anladım" still counts as having seen it, which
	 * is the behaviour anyone would expect from a notice they swiped away.
	 */
	const dismiss = useCallback(() => setIsVisible(false), []);

	return { dismiss, isVisible };
};
