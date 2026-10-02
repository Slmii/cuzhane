import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { nextLegStart, stepsFor, TOUR_STEPS, type TourChoice, type TourStep, type TourTargetId } from './tourSteps';

/**
 * A measured element, in window coordinates — what the spotlight cuts out of the scrim.
 *
 * `radius` lets a target say its own shape, for the one case where the scrim's default rounded
 * rectangle is wrong: a bar glyph on iOS is a **disc**, so a rounded square around it reads as a
 * second, squarer control sitting behind the first. Everything else omits it and gets the
 * overlay's own corner.
 */
export type TourRect = { x: number; y: number; width: number; height: number; radius?: number };

/**
 * The group the Cevşen part walks through, and the bab it opens in the reader. Ana sayfa nominates
 * it — the topmost row — and while the tour runs that row is a demo group.
 */
export type TourSubject = { groupId: string; babNumber: number };

type TourContextValue = {
	isActive: boolean;
	/** True while something else owns the screen — today, the animated splash. */
	isBlocked: boolean;
	/**
	 * Whether the tour's screens answer with `tourDemoData`: the whole run but its closing card,
	 * which sits over the reader's own Ana sayfa ("Örnek gruplar kalktı").
	 */
	isDemo: boolean;
	/**
	 * Ends the demo. `useTourNavigation` calls it once it has taken the reader back to Ana sayfa
	 * — at the closing card, or when the tour ends — never before.
	 */
	releaseDemo: () => void;
	/** The stops this run walks — the whole tour, or one kind's part (TP). */
	run: readonly TourStep[];
	/** Index into `run`. */
	stepIndex: number;
	/** "Turu bitirelim mi?" (TX) is open over the current stop. */
	isConfirmingEnd: boolean;
	rects: Partial<Record<TourTargetId, TourRect>>;
	subject: TourSubject | null;
	setSubject: (subject: TourSubject | null) => void;
	/**
	 * Opens the tour on the whole run, or — from Profil — on one kind's part alone; or, from a free
	 * reader, "Birlikte oku"'s one-stop hint (`live`).
	 */
	start: (choice?: TourChoice) => void;
	next: () => void;
	/** One stop back, never before the run's first. */
	back: () => void;
	/** "Bu bölümü geç": the next part's first stop, or the end of a run that has no more. */
	skipPart: () => void;
	/** "Turu geç" and T1's "Şimdi değil": asks first (TX). */
	askToEnd: () => void;
	/** TX's "Tura devam et": back to the stop it was asked from. */
	keepGoing: () => void;
	/** Ends the tour and records that it has been seen. */
	finish: () => void;
	registerTarget: (id: TourTargetId, rect: TourRect | null) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

/**
 * Holds the tour's position and the rectangles it can point at.
 *
 * **The measurements live here rather than in the overlay** because the things being pointed at
 * are inside the navigator and the overlay is outside it. A registry in the middle lets a screen
 * say "this is today's reading" without knowing a tour exists, lets the overlay draw a hole
 * without reaching into a screen, and is what makes stops across seven screens possible at all:
 * each screen registers whatever it owns as it is focused.
 *
 * **Nothing may open while the splash is up.** `AnimatedSplash` is a React view inside the
 * navigator, and TX is an OS bottom sheet presented above everything — asking UIKit to present
 * one against a screen that is itself mid-transition raced, and lost. `isBlocked` is
 * `AppContainer` saying "not yet".
 *
 * A rect the tour never receives is not an error: `registerTarget(id, null)` on unmount is how a
 * screen says the element is gone. The overlay waits for it rather than cutting out a stale one.
 */
export const TourProvider = ({ children, isBlocked = false }: { children: ReactNode; isBlocked?: boolean }) => {
	const [isActive, setIsActive] = useState(false);
	const [run, setRun] = useState<readonly TourStep[]>(TOUR_STEPS);
	const [stepIndex, setStepIndex] = useState(0);
	const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
	/*
	 * **Its own flag, not `isActive` and the step read together.** Derived, it flipped on the very
	 * render that showed the closing card or ended the tour — while the Hizb reader or a group screen
	 * was still mounted on a stand-in id, so their queries went to the server as
	 * `tour-demo-hizb/…` for the frame before the navigation effect popped them. Released by the
	 * navigation, in the same effect that pops them, the flip and the unmount are one render.
	 */
	const [isDemo, setIsDemo] = useState(false);
	const [rects, setRects] = useState<Partial<Record<TourTargetId, TourRect>>>({});
	const [subject, setSubjectState] = useState<TourSubject | null>(null);
	/*
	 * `mutate` rather than the mutation object: `useMutation` returns a new object on every
	 * render, so depending on it made `finish` — and therefore the memoised context value —
	 * change on every render of this provider. Every `TourTarget` and every consumer of the
	 * demo-aware query hooks re-rendered with it, for a value that had not moved.
	 */
	const { mutate: updateUserSettings } = useUpdateUserSettings();

	/*
	 * Writing `hasSeenTour` is guarded per session, not by the query: `finish` is reachable from
	 * TX, the closing card and the last stop of a part, and the settings mutation is optimistic —
	 * firing it more than once would queue round trips for one fact.
	 */
	const hasRecorded = useRef(false);

	const start = useCallback<TourContextValue['start']>((choice = 'all') => {
		// A hint stands on the reader's own screen: no stand-in data, and seeing it is not seeing
		// the tour — so there is nothing to record when it ends.
		const isHint = choice === 'live';

		hasRecorded.current = isHint;
		setRun(stepsFor(choice));
		setStepIndex(0);
		setIsConfirmingEnd(false);
		setIsDemo(!isHint);
		setIsActive(true);
	}, []);

	const releaseDemo = useCallback(() => setIsDemo(false), []);

	const finish = useCallback(() => {
		setIsActive(false);
		setIsConfirmingEnd(false);

		if (hasRecorded.current) {
			return;
		}

		hasRecorded.current = true;
		updateUserSettings({ hasSeenTour: true });
	}, [updateUserSettings]);

	// Past the run's last stop is its end: the closing card's "Tamam", or the last stop of a part.
	const goTo = useCallback(
		(index: number) => {
			if (index >= run.length) {
				finish();

				return;
			}

			setStepIndex(index);
		},
		[finish, run.length]
	);

	const next = useCallback(() => goTo(stepIndex + 1), [goTo, stepIndex]);
	const skipPart = useCallback(() => goTo(nextLegStart(run, stepIndex)), [goTo, run, stepIndex]);
	const back = useCallback(() => setStepIndex(current => Math.max(0, current - 1)), []);
	const askToEnd = useCallback(() => setIsConfirmingEnd(true), []);
	const keepGoing = useCallback(() => setIsConfirmingEnd(false), []);

	/*
	 * Ana sayfa re-nominates on every render it has groups on, so this short-circuits on an
	 * unchanged pair — otherwise it would set state every frame the shelf re-renders.
	 */
	const setSubject = useCallback((next: TourSubject | null) => {
		setSubjectState(current => {
			if (current === null && next === null) {
				return current;
			}

			if (
				current !== null &&
				next !== null &&
				current.groupId === next.groupId &&
				current.babNumber === next.babNumber
			) {
				return current;
			}

			return next;
		});
	}, []);

	const registerTarget = useCallback((id: TourTargetId, rect: TourRect | null) => {
		setRects(current => {
			const existing = current[id];

			if (rect === null) {
				return existing === undefined ? current : { ...current, [id]: undefined };
			}

			// Layout fires on every scroll frame on some screens; only a moved box is news.
			if (
				existing !== undefined &&
				existing.x === rect.x &&
				existing.y === rect.y &&
				existing.width === rect.width &&
				existing.height === rect.height &&
				existing.radius === rect.radius
			) {
				return current;
			}

			return { ...current, [id]: rect };
		});
	}, []);

	const value = useMemo<TourContextValue>(
		() => ({
			askToEnd,
			back,
			finish,
			isActive,
			isBlocked,
			isConfirmingEnd,
			isDemo,
			keepGoing,
			next,
			rects,
			registerTarget,
			releaseDemo,
			run,
			setSubject,
			skipPart,
			start,
			stepIndex,
			subject
		}),
		[
			askToEnd,
			back,
			finish,
			isActive,
			isBlocked,
			isConfirmingEnd,
			isDemo,
			keepGoing,
			next,
			rects,
			registerTarget,
			releaseDemo,
			run,
			setSubject,
			skipPart,
			start,
			stepIndex,
			subject
		]
	);

	return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

/**
 * The tour's controls. Safe to call from anywhere inside `AppRoot` — outside the provider it
 * throws rather than silently doing nothing, because a "Uygulama turu" row that quietly fails
 * is worse than one that never shipped.
 */
export const useTour = () => {
	const context = useContext(TourContext);

	if (context === null) {
		throw new Error('useTour must be used inside TourProvider.');
	}

	return context;
};

/**
 * Whether this account still has the tour coming to it.
 *
 * `hasSeenTour` defaults to `false` in the database, so **everyone already using the app gets
 * it once as well** — which is what was asked for, and costs nothing: the column's default is
 * the whole mechanism. Nobody is special-cased and no backfill runs.
 */
export const useShouldAutoStartTour = () => {
	const { data: settings } = useGetUserSettings();

	return settings !== undefined && settings.hasSeenOnboarding && !settings.hasSeenTour;
};

/**
 * Whether the queries behind the tour's screens should answer with `tourDemoData` rather than
 * the network — **whenever the tour is running, for everybody**, up to its closing card.
 *
 * It was conditional at first, on the account having no group of its own, so that a reader with
 * real groups would walk their own. That made the walkthrough two different things: the copy has
 * to describe what is on screen, and what was on screen depended on who was looking. A
 * demonstration is the same demonstration for everyone, and a reader's own groups are one tap
 * away the moment it ends.
 *
 * It depends on nothing the demo data itself provides, which is what keeps it honest: a flag
 * derived from the shelf would see the stand-in shelf it had just installed and flip back.
 */
export const useIsTourDemo = () => useTour().isDemo;
