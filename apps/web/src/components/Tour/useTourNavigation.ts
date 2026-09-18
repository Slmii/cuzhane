import { navigationRef } from '@/navigation/navigationRef';
import { CommonActions, StackActions, type NavigationState, type PartialState } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { useTour, WELCOME_STEP } from './Tour.context';
import { TOUR_DEMO_SUBJECT } from './tourDemoData';
import { TOUR_STEPS, type TourPlace } from './tourSteps';

type AnyNavigationState = NavigationState | PartialState<NavigationState>;

/**
 * The `Tab.Screen` each tab-rooted place is.
 *
 * Two of the five places are tabs of their own rather than screens pushed onto one, so reaching
 * them is a different move: unwind whatever the tour pushed, then switch tab. The group screen,
 * the reader, Hatırlatma and Profil are all pushed *inside* whichever tab is current, and go
 * through `navigate` instead.
 *
 * **Ana sayfa and the inbox are the two tabs.** Hatırlatma was the second until the bell tab
 * was given to the notification inbox and its settings moved one push in — so the inbox took
 * its place here and the settings are now reached the way Profil's stops are.
 */
const TAB_BY_PLACE = { home: 'Home', inbox: 'Notifications' } as const;

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
 * Puts the reader on one of the tour's two tab-rooted screens: Ana sayfa, or Hatırlatma.
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
 * while the first three cards described Ana sayfa's streak card and group rows. Where someone
 * started the tour from is not the tour's business; stop 1 is on Ana sayfa either way. The guard
 * existed only to keep a no-op pop from logging "POP_TO_TOP was not handled", and a targeted pop
 * that is only dispatched when there is a stack to pop cannot log it.
 *
 * The tab switch covers the other half of that: on Android Profil *is* a tab, and on iOS it is
 * pushed inside whichever tab you were on — so popping alone can land on Gruplarım.
 */
const goToTourTab = (tab: (typeof TAB_BY_PLACE)[keyof typeof TAB_BY_PLACE]) => {
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

/**
 * Walks the app while the tour walks its stops.
 *
 * Eleven of the fourteen stops are on a group's screen, in the reader, on Hatırlatma or on Profil, so the tour has to
 * take the reader there. It drives `navigationRef` rather than a screen's own `navigation`
 * because the overlay deliberately lives outside every navigator — the same reason the
 * rectangles live in a context.
 *
 * **It navigates on the change of screen, not on every step.** Four pairs of stops share a
 * screen (two on the group, two in the reader, three on Profil), and re-navigating for the
 * second of a pair would push a duplicate and re-run the screen's entrance under the scrim.
 *
 * **Everything is pushed inside the tab the tour is running in, and unwound in one move.**
 * `sharedTabScreens` registers the group screen, the reader and Profil in all five tabs, so each
 * `navigate` pushes onto that tab's own stack and `goToTourTab` unwinds the lot — at the welcome
 * card, so the tour begins on Ana sayfa wherever it was started from, at the Hatırlatma stop, and
 * again before the closing card, which is where its two actions make sense from.
 *
 * **The group it walks is always a stand-in** — see `useIsTourDemo`. The tour opens straight
 * after onboarding, when the reader belongs to nothing at all, so there is often no group of
 * theirs to walk; making it the same three for everybody is what lets the copy describe what is
 * actually on screen.
 */
export const useTourNavigation = () => {
	const { isActive, stepIndex, subject: nominated } = useTour();

	/*
	 * Ana sayfa nominates the group, and while the tour runs its shelf is the stand-in one, so
	 * what it nominates is a demo group. The fallback covers the frames before it has: the tour
	 * opens on the welcome card and the shelf may still be rendering behind it.
	 */
	const subject = useMemo(() => nominated ?? TOUR_DEMO_SUBJECT, [nominated]);

	// The screen the tour last sent anyone to. `null` means it has not moved them at all, which
	// is also the state it returns to when the tour ends.
	const currentPlace = useRef<TourPlace | null>(null);

	useEffect(() => {
		if (!isActive) {
			/*
			 * **Ending the tour has to bring the reader back, not just stop drawing.** "Atla" is
			 * reachable from every card, and six of the fourteen stops stand on a screen belonging
			 * to a **stand-in** group — so skipping from stop 4 left someone on `GroupDetail` for
			 * `tour-demo-group-1`, whose queries flip to the real keys the instant `isActive`
			 * drops, are refused by the server, and land on `ErrorState` with a "Tekrar dene" that
			 * can never work.
			 *
			 * Only when the tour actually moved them. At the closing card `currentPlace` is
			 * already `home`, and "Yeni grup kur" there calls `finish()` and then opens
			 * create-group — a sheet route on the **root** stack, which an unwind would pop
			 * straight back off.
			 */
			if (currentPlace.current !== null && currentPlace.current !== 'home') {
				goToTourTab(TAB_BY_PLACE.home);
			}

			currentPlace.current = null;

			return;
		}

		if (!navigationRef.isReady()) {
			return;
		}

		/*
		 * **The welcome card moves nobody.** It is a sheet over whatever screen the reader was
		 * looking at, and "Daha sonra" has to leave them there — dragging someone from Profil to
		 * Ana sayfa to ask whether they want a tour, and stranding them there when they say no,
		 * is a worse answer than not asking from that screen at all.
		 *
		 * It also removes a race rather than mitigating one: navigating here meant a `popToTop`
		 * and a tab switch dispatched in the same commit as an OS sheet presenting, which is
		 * exactly the shape that lost to UIKit once already (see `TourProvider`'s note on the
		 * splash). Stop 1 does the unwinding instead, a tap later, with nothing else in flight.
		 */
		if (stepIndex === WELCOME_STEP) {
			return;
		}

		// The closing card belongs to Ana sayfa, where the tour began.
		const step = TOUR_STEPS[stepIndex];
		const place: TourPlace = step?.place ?? 'home';

		if (place === currentPlace.current) {
			return;
		}

		// Nothing to open, so nothing is opened — see the note above.
		if (subject === null && place !== 'home' && place !== 'inbox' && place !== 'reminders') {
			return;
		}

		currentPlace.current = place;

		const tab = place === 'home' || place === 'inbox' ? TAB_BY_PLACE[place] : undefined;

		if (tab !== undefined) {
			goToTourTab(tab);

			return;
		}

		// Typed loosely on purpose: these routes sit on whichever tab stack is focused, and this
		// hook is outside all of them.
		const navigate = navigationRef.navigate as unknown as (name: string, params: object) => void;

		if (place === 'group') {
			navigate('GroupDetail', { groupId: subject!.groupId });
			return;
		}

		if (place === 'reader') {
			navigate('BabReader', { babNumber: subject!.babNumber, groupId: subject!.groupId });
			return;
		}

		if (place === 'reminders') {
			navigate('Reminders', {});
			return;
		}

		navigate('Profile', {});
	}, [isActive, stepIndex, subject]);
};
