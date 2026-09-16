import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { useShouldAutoStartTour, useTour, type TourSubject } from './Tour.context';

/**
 * Opens the tour the first time an account lands on Ana sayfa.
 *
 * **Ana sayfa rather than `AppRoot`, and only while it is focused.** The tour points at things
 * on this screen, so starting it from the root would open it over Onboarding or the sign-in
 * stack. Mounting is not enough either: the tabs are not lazy, so Ana sayfa mounts on launch
 * even when a scanned invite link lands the reader on Gruplarım with the join sheet open — and
 * the tour would have thrown its card over that, spending its one automatic opening on a screen
 * it does not describe.
 *
 * It used to register a rectangle for the bottom bar as well, computed from
 * `useBottomTabBarHeight` because `react-native-bottom-tabs` draws a real UIKit bar with no
 * React view to measure. That stop is gone — the bar labels itself — and the arithmetic went
 * with it.
 */
export const useTourAutoStart = ({ subject }: { subject: TourSubject | null }) => {
	const { isActive, isBlocked, setSubject, start } = useTour();
	const shouldAutoStart = useShouldAutoStartTour();
	const isFocused = useIsFocused();

	/*
	 * Ana sayfa nominates the group the later stops walk through — the topmost row, the same one
	 * whose Read button is stop 3. It is kept current rather than captured once at the start: the
	 * shelf can still be loading when the tour opens, and a tour that had nothing to point at
	 * then would keep nothing for its whole run.
	 */
	useEffect(() => {
		setSubject(subject);
	}, [setSubject, subject]);

	// One automatic opening per launch. Without this, dismissing the tour before the settings
	// mutation lands would re-open it on the very next render.
	const hasAutoStarted = useRef(false);

	useEffect(() => {
		if (isBlocked || !isFocused || !shouldAutoStart || hasAutoStarted.current || isActive) {
			return;
		}

		hasAutoStarted.current = true;
		start();
	}, [isActive, isBlocked, isFocused, shouldAutoStart, start]);
};
