import { navigationRef } from '@/navigation/navigationRef';
import { CommonActions, StackActions, type NavigationState, type PartialState } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { useTour, type TourSubject } from './Tour.context';
import {
	TOUR_DEMO_HATIM_SUBJECT,
	TOUR_DEMO_HIZB_SUBJECT,
	TOUR_DEMO_JOIN_HATIM_ID,
	TOUR_DEMO_SUBJECT
} from './tourDemoData';
import type { TourPlace } from './tourSteps';

type AnyNavigationState = NavigationState | PartialState<NavigationState>;

/**
 * The two tab-rooted places. Reaching one is a different move from the rest: unwind whatever the
 * tour pushed, then switch tab. The group screens, the cüz pages and the readers are all pushed
 * *inside* whichever tab is current, and go through `navigate` instead.
 */
type TourTab = 'Home' | 'Groups';

/**
 * The two handles on the tree that "go to Ana sayfa" needs: the deepest focused stack that has
 * something pushed on it, and the tab navigator.
 *
 * Walking rather than assuming root → tabs → stack keeps this honest if a stop is ever added
 * somewhere else, and `index > 0` is what makes the stack key mean "there is something to
 * unwind" — a stack sitting on its own root must not shadow one deeper down that isn't.
 */
const focusedBranch = () => {
	let state: AnyNavigationState | undefined = navigationRef.getRootState();
	let pushedStackKey: string | undefined;
	let tabs: AnyNavigationState | undefined;

	while (state !== undefined) {
		const index: number = state.index ?? state.routes.length - 1;

		if (state.type === 'stack' && state.key !== undefined && index > 0) {
			pushedStackKey = state.key;
		}

		if (state.type === 'tab') {
			tabs = state;
		}

		state = state.routes[index]?.state;
	}

	return { pushedStackKey, tabs };
};

/**
 * Puts the reader back on a tab's own root — Ana sayfa, or Gruplarım for T3.
 *
 * **Both halves are load-bearing, and each was a bug on its own.**
 *
 * *The pop needs a `target`.* An action dispatched without one is offered to a navigator and then
 * bubbles **up**; it never descends into a tab's nested stack — which is where the tour's own
 * pushes live. So the untargeted `popToTop` at the closing card did nothing and that card was read
 * over Profil. `AppNavigator`'s `resetTabStack` has always targeted its pop for the same reason.
 *
 * *And it must run whether or not the tour did the pushing.* It used to be guarded on the tour
 * having pushed something itself, so replaying from the row on Profil left the reader on Profil
 * while the first cards described Ana sayfa. Where someone started the tour from is not the
 * tour's business; T1 is on Ana sayfa either way. The guard
 * existed only to keep a no-op pop from logging "POP_TO_TOP was not handled", and a targeted pop
 * that is only dispatched when there is a stack to pop cannot log it.
 *
 * The tab switch covers the other half of that: on Android Profil *is* a tab, and on iOS it is
 * pushed inside whichever tab you were on — so popping alone can land on Gruplarım.
 */
const goToTab = (tab: TourTab) => {
	const { pushedStackKey, tabs } = focusedBranch();

	if (pushedStackKey !== undefined) {
		navigationRef.dispatch({ ...StackActions.popToTop(), target: pushedStackKey });
	}

	if (tabs === undefined || tabs.key === undefined) {
		return;
	}

	const focusedTab = tabs.routes[tabs.index ?? tabs.routes.length - 1]?.name;

	if (focusedTab !== tab) {
		// Leaving a tab pops its stack (`resetTabStack`'s `blur`), so the tab being left tidies
		// itself up whether or not the pop above was the one that reached it.
		navigationRef.dispatch({ ...CommonActions.navigate(tab), target: tabs.key });
	}
};

/** The pushed places, each onto whichever tab stack is focused. */
const navigateTo = (place: Exclude<TourPlace, 'home' | 'groups' | 'here'>, subject: TourSubject) => {
	// Typed loosely on purpose: these routes sit on whichever tab stack is focused, and this
	// hook is outside all of them.
	const navigate = navigationRef.navigate as unknown as (name: string, params: object) => void;

	switch (place) {
		case 'group':
			navigate('GroupDetail', { groupId: subject.groupId });
			return;
		case 'reader':
			navigate('BabReader', { babNumber: subject.babNumber, groupId: subject.groupId });
			return;
		// K1: choosing cüz in a hatim you are joining; K2: the page of one you hold.
		case 'pickCuz':
			navigate('PickCuz', { groupId: TOUR_DEMO_JOIN_HATIM_ID });
			return;
		case 'cuz':
			navigate('CuzDetail', TOUR_DEMO_HATIM_SUBJECT);
			return;
		// H1: the Hizb group's screen; H2: today's reading in its reader.
		case 'hizbGroup':
			navigate('GroupDetail', { groupId: TOUR_DEMO_HIZB_SUBJECT.groupId });
			return;
		case 'hizbReader':
			navigate('HizbPlanReader', TOUR_DEMO_HIZB_SUBJECT);
	}
};

/**
 * Walks the app while the tour walks its stops.
 *
 * Every stop after T2 is on another screen — Gruplarım, a group, a reader, a cüz page — so the tour
 * has to take the reader there. It drives `navigationRef` rather than a screen's own `navigation`
 * because the overlay deliberately lives outside every navigator — the same reason the
 * rectangles live in a context.
 *
 * **It navigates on the change of screen, not on every step.** T1 and T2 share Ana sayfa, and
 * re-navigating for the second of a pair would push a duplicate and re-run the screen's entrance
 * under the scrim.
 *
 * **Everything after T3 is pushed inside the Gruplarım tab, and unwound in one move.**
 * `sharedTabScreens` registers the group screens, the cüz pages and the readers in every tab, so
 * each `navigate` pushes onto Gruplarım's own stack and `goToTab('Home')` unwinds the lot — at T1, so
 * the tour begins on Ana sayfa wherever it was started from, and again at the closing card.
 *
 * **Every group it walks is a stand-in** — see `useIsTourDemo`. The tour opens straight after
 * onboarding, when the reader belongs to nothing at all, so there is often no group of theirs to
 * walk; making it the same groups for everybody is what lets the copy describe what is actually on
 * screen.
 */
export const useTourNavigation = () => {
	const { isActive, releaseDemo, run, stepIndex, subject: nominated } = useTour();

	/*
	 * Ana sayfa nominates the Cevşen group, and while the tour runs its shelf is the stand-in one,
	 * so what it nominates is a demo group. The fallback covers a run that never showed Ana sayfa —
	 * one kind's part, started from Profil.
	 */
	const subject = useMemo(() => nominated ?? TOUR_DEMO_SUBJECT, [nominated]);

	// The screen the tour last sent anyone to. `null` means it has not moved them at all, which
	// is also the state it returns to when the tour ends.
	const currentPlace = useRef<TourPlace | null>(null);

	useEffect(() => {
		if (!isActive) {
			/*
			 * **Ending the tour has to bring the reader back, not just stop drawing.** "Turu geç"
			 * is reachable from every stop, and most stand on a screen belonging to a **stand-in**
			 * group — so ending from C1 left someone on `GroupDetail` for `tour-demo-group-1`,
			 * whose queries flip to the real keys the instant the demo ends, are refused by the
			 * server, and land on `ErrorState` with a "Tekrar dene" that can never work.
			 *
			 * Only when the tour actually moved them away: at the closing card it is on Ana sayfa
			 * already.
			 */
			if (currentPlace.current !== null && currentPlace.current !== 'home') {
				goToTab('Home');
			}

			currentPlace.current = null;
			// After the pop, in the same effect: the stand-in screens unmount on the render the
			// demo ends, rather than asking the server for their stand-in ids first.
			releaseDemo();

			return;
		}

		if (!navigationRef.isReady()) {
			return;
		}

		const step = run[stepIndex];
		const place: TourPlace = step?.place ?? 'home';

		// A hint's stop is wherever the reader already is: never moved there, never brought back.
		if (place === 'here') {
			return;
		}

		if (place !== currentPlace.current) {
			currentPlace.current = place;

			if (place === 'home' || place === 'groups') {
				goToTab(place === 'home' ? 'Home' : 'Groups');
			} else {
				navigateTo(place, subject);
			}
		}

		// The closing card stands on the reader's own Ana sayfa — see `releaseDemo`.
		if (step?.kind === 'closing') {
			releaseDemo();
		}
	}, [isActive, releaseDemo, run, stepIndex, subject]);
};
