import { navigationRef } from '@/navigation/navigationRef';
import { CommonActions, StackActions, type NavigationState, type PartialState } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { useTour, WELCOME_STEP } from './Tour.context';
import { TOUR_DEMO_HATIM_SUBJECT, TOUR_DEMO_SUBJECT } from './tourDemoData';
import { TOUR_STEPS, type TourPlace } from './tourSteps';

type AnyNavigationState = NavigationState | PartialState<NavigationState>;

/**
 * The one tab-rooted place. Reaching it is a different move from the rest: unwind whatever the
 * tour pushed, then switch tab. The group screens, the cüz page, the readers and Profil are all
 * pushed *inside* whichever tab is current, and go through `navigate` instead.
 */
const HOME_TAB = 'Home';

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
 * Puts the reader back on Ana sayfa, the tour's one tab-rooted screen.
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
const goToTourHome = () => {
	const { pushedStackKey, tabs } = focusedBranch();

	if (pushedStackKey !== undefined) {
		navigationRef.dispatch({ ...StackActions.popToTop(), target: pushedStackKey });
	}

	if (tabs === undefined || tabs.key === undefined) {
		return;
	}

	const focusedTab = tabs.routes[tabs.index ?? tabs.routes.length - 1]?.name;

	if (focusedTab !== HOME_TAB) {
		// Leaving a tab pops its stack (`resetTabStack`'s `blur`), so the tab being left tidies
		// itself up whether or not the pop above was the one that reached it.
		navigationRef.dispatch({ ...CommonActions.navigate(HOME_TAB), target: tabs.key });
	}
};

/**
 * Walks the app while the tour walks its stops.
 *
 * Thirteen of the fifteen stops are on a group's screen, a cüz page, a reader or Profil, so the
 * tour has to take the reader there. It drives `navigationRef` rather than a screen's own `navigation`
 * because the overlay deliberately lives outside every navigator — the same reason the
 * rectangles live in a context.
 *
 * **It navigates on the change of screen, not on every step.** Stops share a screen in runs
 * (five on the Cevşen group, two on the Kur'an one, two in the Cevşen reader, two on Profil), and re-navigating for the
 * second of a pair would push a duplicate and re-run the screen's entrance under the scrim.
 *
 * **Everything is pushed inside the tab the tour is running in, and unwound in one move.**
 * `sharedTabScreens` registers the group screen, the readers and Profil in all five tabs, so each
 * `navigate` pushes onto that tab's own stack and `goToTourHome` unwinds the lot — at stop 1, so
 * the tour begins on Ana sayfa wherever it was started from, and again before the closing card,
 * which is where its two actions make sense from.
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
			 * reachable from every card, and eleven of the fifteen stops stand on a screen belonging
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
				goToTourHome();
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

		// Nothing to open, so nothing is opened — see the note above. The Kur'an leg always opens
		// its own demo group, so only the Cevşen leg depends on a nominated subject.
		if (subject === null && (place === 'group' || place === 'reader')) {
			return;
		}

		currentPlace.current = place;

		if (place === 'home') {
			goToTourHome();

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

		/*
		 * The Kur'an leg: its own demo group, then that group's unread cüz — its page, then the
		 * reader. Each is a push onto the same stack, over the Cevşen reader; the closing card's
		 * `popToTop` unwinds the lot.
		 */
		if (place === 'hatimGroup') {
			navigate('GroupDetail', { groupId: TOUR_DEMO_HATIM_SUBJECT.groupId });
			return;
		}

		if (place === 'cuz') {
			navigate('CuzDetail', TOUR_DEMO_HATIM_SUBJECT);
			return;
		}

		if (place === 'cuzReader') {
			navigate('CuzReader', TOUR_DEMO_HATIM_SUBJECT);
			return;
		}

		navigate('Profile', {});
	}, [isActive, stepIndex, subject]);
};
