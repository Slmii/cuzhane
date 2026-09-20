import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { TOUR_STEPS, type TourTargetId } from './tourSteps';

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
 * The group the tour walks through, and the bab it opens in the reader.
 *
 * Six of the ten stops are on a group's own screens, so the tour needs one to point at. Ana
 * sayfa nominates it — the topmost row, the same group whose Read button is stop 3 — and a
 * reader who belongs to no group leaves this null, which is what keeps stops 4 to 10 on their
 * centred cards instead of navigating into a group that does not exist.
 */
export type TourSubject = { groupId: string; babNumber: number };

type TourContextValue = {
	isActive: boolean;
	/** True while something else owns the screen — today, the animated splash. */
	isBlocked: boolean;
	/** `-1` is the welcome card, `TOUR_STEPS.length` is the closing card. */
	stepIndex: number;
	rects: Partial<Record<TourTargetId, TourRect>>;
	subject: TourSubject | null;
	setSubject: (subject: TourSubject | null) => void;
	/**
	 * Opens the tour. `isReplay` drops **both bookend cards** — for the row on Profil, where
	 * neither is doing anything for the reader who tapped it.
	 *
	 * The welcome card asks whether they want the tour, which is the decision they just made,
	 * and would present over Profil — a screen it does not describe. The closing card offers
	 * "Grup kur" and then says the tour lives in Profil › Uygulama turu, which is the row they
	 * came from. A replay runs stop 1 to stop 15 and ends.
	 */
	start: (options?: { isReplay?: boolean }) => void;
	next: () => void;
	/**
	 * One stop back. **Never past stop 1** — the welcome card is a decision already made, and
	 * returning to it would ask again; on a replay it is not in the run at all.
	 */
	back: () => void;
	/** Ends the tour and records that it has been seen — used by both Skip and Finish. */
	finish: () => void;
	registerTarget: (id: TourTargetId, rect: TourRect | null) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export const WELCOME_STEP = -1;

/**
 * Holds the tour's position and the rectangles it can point at.
 *
 * **The measurements live here rather than in the overlay** because the things being pointed at
 * are inside the navigator and the overlay is outside it. A registry in the middle lets a screen
 * say "this is the streak card" without knowing a tour exists, lets the overlay draw a hole
 * without reaching into a screen, and is what makes ten stops across four screens possible at
 * all: each screen registers whatever it owns as it is focused.
 *
 * **Nothing may open while the splash is up.** `AnimatedSplash` is a React view inside the
 * navigator, and the welcome card is an OS bottom sheet presented above everything — asking
 * UIKit to present one against a screen that is itself mid-transition raced, and lost: the
 * sheet never appeared, while the tour sat `isActive` with nothing on screen and no way out.
 * `isBlocked` is `AppContainer` saying "not yet".
 *
 * A rect the tour never receives is not an error: `registerTarget(id, null)` on unmount is how
 * Ana sayfa says the streak card is gone, which is exactly what a reader with no groups sees.
 * The overlay centres that step instead of cutting out a stale rectangle.
 */
export const TourProvider = ({ children, isBlocked = false }: { children: ReactNode; isBlocked?: boolean }) => {
	const [isActive, setIsActive] = useState(false);
	const [stepIndex, setStepIndex] = useState(WELCOME_STEP);
	const [rects, setRects] = useState<Partial<Record<TourTargetId, TourRect>>>({});
	const [subject, setSubjectState] = useState<TourSubject | null>(null);
	/*
	 * `mutate` rather than the mutation object: `useMutation` returns a new object on every
	 * render, so depending on it made `finish` — and therefore the memoised context value —
	 * change on every render of this provider. Every `TourTarget` and every consumer of the five
	 * demo-aware query hooks re-rendered with it, for a value that had not moved.
	 */
	const { mutate: updateUserSettings } = useUpdateUserSettings();

	/*
	 * Writing `hasSeenTour` is guarded per session, not by the query: `finish` is reachable
	 * from Skip, Finish and the backdrop, and the settings mutation is optimistic — firing it
	 * three times would queue three round trips for one fact.
	 */
	const hasRecorded = useRef(false);

	/** Whether this run is a replay from Profil — see `start`. Held for `next`'s last step. */
	const isReplay = useRef(false);

	const start = useCallback<TourContextValue['start']>(options => {
		hasRecorded.current = false;
		isReplay.current = options?.isReplay === true;
		/*
		 * Stop 1 is on Ana sayfa either way, so `useTourNavigation` unwinds there on this same
		 * commit — skipping the card changes which screen the reader is looking at when it does,
		 * not whether it happens.
		 */
		setStepIndex(options?.isReplay ? 0 : WELCOME_STEP);
		setIsActive(true);
	}, []);

	const finish = useCallback(() => {
		setIsActive(false);

		if (hasRecorded.current) {
			return;
		}

		hasRecorded.current = true;
		updateUserSettings({ hasSeenTour: true });
	}, [updateUserSettings]);

	/*
	 * Devam on the last stop ends a replay outright rather than landing on the closing card.
	 * `finish` also unwinds to Ana sayfa through `useTourNavigation`'s inactive branch, so a
	 * replay that ended on Profil's own stops leaves the reader where the tour began.
	 */
	const next = useCallback(() => {
		if (isReplay.current && stepIndex + 1 >= TOUR_STEPS.length) {
			finish();

			return;
		}

		setStepIndex(current => current + 1);
	}, [finish, stepIndex]);

	/*
	 * The floor is stop 0, not `WELCOME_STEP`: the card behind that one asks whether they want
	 * the tour, and they have answered. `TourStepCard` hides the control there rather than
	 * drawing a dead one.
	 */
	const back = useCallback(() => {
		setStepIndex(current => Math.max(0, current - 1));
	}, []);

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
			back,
			finish,
			isActive,
			isBlocked,
			next,
			rects,
			registerTarget,
			setSubject,
			start,
			stepIndex,
			subject
		}),
		[back, finish, isActive, isBlocked, next, rects, registerTarget, setSubject, start, stepIndex, subject]
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
 * the network — which is **whenever the tour is running, for everybody**.
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
export const useIsTourDemo = () => useTour().isActive;
