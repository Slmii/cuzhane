import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import type { LiveReadingKind } from '@/lib/types/domain';
import { hasSeenLiveHint, markLiveHintSeen } from '@/lib/utils/liveHintSeen';
import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';
import { useTour } from './Tour.context';

/**
 * Long enough for the pushed reader to land and for UIKit to place the bar's items — the button
 * the hint points at is measured once it is there (`TourTarget`'s own settle follows this).
 */
const SETTLE_MS = 600;

/*
 * Once per launch, whatever the store says: ending the hint re-runs the effect below, and a write
 * that failed would otherwise put the card straight back.
 */
let hasShownThisLaunch = false;

/**
 * Shows "Birlikte oku"'s hint the first time this phone opens a free reader — the free Mushaf or
 * the free Cevşen, whichever comes first.
 *
 * **Never over something else.** Not while the tour runs (or the splash holds it back), not on a
 * screen that is covered, and not while a reading of this kind is already on: whoever is in one
 * has found the button.
 *
 * **Marked seen as it is shown, not when it is dismissed**, so a card cut short — the app closed
 * under it — does not come back either.
 */
export const useLiveHintAutoStart = (kind: LiveReadingKind) => {
	const { isActive, isBlocked, start } = useTour();
	const isFocused = useIsFocused();
	const session = useLiveSessionState();
	const isLive = session !== null && session.kind === kind && session.gone === null;

	useEffect(() => {
		if (hasShownThisLaunch || !isFocused || isBlocked || isActive || isLive) {
			return;
		}

		let isCancelled = false;
		const timer = setTimeout(() => {
			void hasSeenLiveHint().then(isSeen => {
				if (isSeen || isCancelled) {
					return;
				}

				hasShownThisLaunch = true;
				void markLiveHintSeen();
				start('live');
			});
		}, SETTLE_MS);

		return () => {
			isCancelled = true;
			clearTimeout(timer);
		};
	}, [isActive, isBlocked, isFocused, isLive, start]);
};
