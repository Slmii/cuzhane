import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetHints, useMarkHintsSeen, useResetHints } from '@/lib/hooks/useHints';
import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { clearLiveHintSeen, hasSeenLiveHint } from '@/lib/utils/liveHintSeen';
import { useIsAnyOverlayOpen } from '@/lib/utils/openOverlays';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';
import { hintQueue, isHintBlocked, type HintRect } from './hintQueue';
import { HINTS, LIVE_HINT_ID, WELCOME_HINT_ID, type Hint, type HintScreen, type HintTargetId } from './hints';

/** Long enough for a pushed screen to land and UIKit to place its bar items before a card shows. */
const SETTLE_MS = 600;

type HintSequence = { screen: HintScreen; hints: readonly Hint[]; index: number };
type FocusedScreen = { owner: string; screen: HintScreen };

type HintsContextValue = {
	/** The card on screen, or `null`. */
	current: Hint | null;
	/** Its place in its sequence, 1-based. */
	position: { n: number; of: number };
	/** A card is over the app right now — what `HintBlocker` and What's New read. */
	isShowing: boolean;
	/**
	 * The welcome is still to come for this account; `undefined` while that is not known yet.
	 * What's New waits for it, so the two never collide.
	 */
	isWelcomePending: boolean | undefined;
	/** The animated splash is up — What's New waits for it too. */
	isSplashVisible: boolean;
	rects: Partial<Record<HintTargetId, HintRect>>;
	/**
	 * The card's target has measured itself since its hint came up — scrolled into view where it
	 * had to be. Until then the card waits, rather than showing beside a stale place and jumping.
	 */
	isPlaced: boolean;
	/** `hintId`: the hint that was up when this measurement was taken, or `null`. */
	registerTarget: (id: HintTargetId, rect: HintRect | null, hintId?: string | null) => void;
	/** `useHintScreen`'s report: `owner` is now in front with `screen`, or (`null`) no longer. */
	focusScreen: (owner: string, screen: HintScreen | null) => void;
	/** "Devam", or "Tamam" on the last card. */
	next: () => void;
	/** "İpuçlarını yeniden göster": every hint but the welcome comes back. */
	resetHints: () => Promise<void>;
};

const HintsContext = createContext<HintsContextValue | null>(null);

/**
 * The screens' hints: which one is up, and the rectangles they can point at.
 *
 * **One sequence per screen.** When a screen is focused, every hint of its own that is unseen and
 * whose target is on screen plays, one after another ("1/3", "Devam", … "Tamam"). Each is marked
 * seen as it is shown — on the server, and in this launch's own set so a write that fails never
 * brings a card back before the next launch. A screen that leaves the front ends its sequence;
 * the hints it did not reach stay for next time.
 *
 * **Never over something else** (`HintBlockers`): the splash, a sheet or menu (What's New is one),
 * a live reading, the keyboard. A hint waits for all of them to clear, and for its screen to still
 * be the one in front.
 *
 * **The measurements live here rather than in the overlay** because the things pointed at are
 * inside the navigator and the overlay is outside it: a screen says "this is today's reading"
 * without knowing a hint exists, and the overlay draws a hole without reaching into a screen.
 */
export const HintsProvider = ({ children, isSplashVisible }: { children: ReactNode; isSplashVisible: boolean }) => {
	const { width, height } = useWindowDimensions();
	const { data: settings } = useGetUserSettings();
	const hintsQuery = useGetHints(settings !== undefined);
	const { mutate: markSeen } = useMarkHintsSeen();
	const { mutateAsync: resetOnServer } = useResetHints();
	const isOverlayOpen = useIsAnyOverlayOpen();
	const liveSession = useLiveSessionState();
	const isLive = liveSession !== null && liveSession.gone === null;
	const [isKeyboardUp, setIsKeyboardUp] = useState(() => Keyboard.isVisible());
	const [rects, setRects] = useState<Partial<Record<HintTargetId, HintRect>>>({});
	const [focused, setFocused] = useState<FocusedScreen | null>(null);
	const [sequence, setSequence] = useState<HintSequence | null>(null);
	const [placedHintId, setPlacedHintId] = useState<string | null>(null);
	// Shown this launch, whatever the server has said since.
	const [sessionSeen, setSessionSeen] = useState<ReadonlySet<string>>(() => new Set());
	const userId = useCurrentUserId();
	const [sessionUserId, setSessionUserId] = useState(userId);

	// Another account on this phone starts with nothing shown.
	if (sessionUserId !== userId) {
		setSessionUserId(userId);
		setSessionSeen(new Set());
		setSequence(null);
	}

	// A screen that left the front takes its sequence with it.
	if (sequence !== null && sequence.screen !== focused?.screen) {
		setSequence(null);
	}

	useEffect(() => {
		const shown = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardUp(true));
		const hidden = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardUp(false));

		return () => {
			shown.remove();
			hidden.remove();
		};
	}, []);

	const data = hintsQuery.data;
	const isEnabled = data !== undefined && (settings?.hintsEnabled ?? data.enabled);
	const seenIds = useMemo(() => new Set([...(data?.seenIds ?? []), ...sessionSeen]), [data, sessionSeen]);
	const blockers = useMemo(
		() => ({ isKeyboardUp, isLive, isOverlayOpen, isSplashVisible }),
		[isKeyboardUp, isLive, isOverlayOpen, isSplashVisible]
	);
	const isBlocked = isHintBlocked(blockers);

	/*
	 * The queue as its ids, so a target that only moved — every layout re-measures — does not
	 * restart the settle below.
	 */
	const queueKey = useMemo(
		() =>
			hintQueue({
				blockers,
				hints: HINTS,
				isEnabled,
				rects,
				screen: focused?.screen ?? null,
				seenIds,
				window: { height, width }
			})
				.map(hint => hint.id)
				.join(' '),
		[blockers, focused, height, isEnabled, rects, seenIds, width]
	);

	const show = useCallback(
		(hint: Hint) => {
			setSessionSeen(current => new Set(current).add(hint.id));
			markSeen([hint.id]);
		},
		[markSeen]
	);

	const isIdle = sequence === null;

	useEffect(() => {
		if (!isIdle || queueKey === '') {
			return;
		}

		// Started once the screen has settled; a change to the queue in the meantime starts over.
		const timer = setTimeout(() => {
			const hints = queueKey
				.split(' ')
				.map(id => HINTS.find(hint => hint.id === id))
				.filter((hint): hint is Hint => hint !== undefined);
			const first = hints[0];

			if (first === undefined) {
				return;
			}

			show(first);
			setSequence({ hints, index: 0, screen: first.screen });
		}, SETTLE_MS);

		return () => clearTimeout(timer);
	}, [isIdle, queueKey, show]);

	const next = useCallback(() => {
		const following = sequence?.hints[sequence.index + 1];

		if (sequence === null || following === undefined) {
			setSequence(null);

			return;
		}

		show(following);
		setSequence({ ...sequence, index: sequence.index + 1 });
	}, [sequence, show]);

	/*
	 * **"Birlikte oku"'s hint was once the phone's, not the account's.** A phone that showed it
	 * under the old flag has it marked seen here, once, and the flag is deleted when the server
	 * has it.
	 */
	const hasImportedLiveHint = useRef(false);

	useEffect(() => {
		if (data === undefined || hasImportedLiveHint.current) {
			return;
		}

		hasImportedLiveHint.current = true;

		void hasSeenLiveHint().then(isSeen => {
			if (!isSeen) {
				return;
			}

			setSessionSeen(current => new Set(current).add(LIVE_HINT_ID));
			markSeen([LIVE_HINT_ID], { onSuccess: () => void clearLiveHintSeen() });
		});
	}, [data, markSeen]);

	const resetHints = useCallback(async () => {
		await resetOnServer();
		// The welcome is never brought back.
		setSessionSeen(current => new Set(current.has(WELCOME_HINT_ID) ? [WELCOME_HINT_ID] : []));
	}, [resetOnServer]);

	const focusScreen = useCallback((owner: string, screen: HintScreen | null) => {
		setFocused(current => {
			if (screen !== null) {
				return current?.owner === owner && current.screen === screen ? current : { owner, screen };
			}

			// Only the screen that said it was in front can say it no longer is — the next one may
			// already have taken its place.
			return current?.owner === owner ? null : current;
		});
	}, []);

	const registerTarget = useCallback((id: HintTargetId, rect: HintRect | null, hintId?: string | null) => {
		if (rect !== null && hintId) {
			setPlacedHintId(hintId);
		}

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
				existing.radius === rect.radius &&
				existing.canScroll === rect.canScroll
			) {
				return current;
			}

			return { ...current, [id]: rect };
		});
	}, []);

	const current = sequence?.hints[sequence.index] ?? null;
	const isShowing = current !== null && !isBlocked;
	const isPlaced = current !== null && (current.target === null || placedHintId === current.id);
	const isWelcomePending =
		data === undefined ? (hintsQuery.isError ? false : undefined) : isEnabled && !seenIds.has(WELCOME_HINT_ID);
	const position = useMemo(() => ({ n: (sequence?.index ?? 0) + 1, of: sequence?.hints.length ?? 0 }), [sequence]);

	const value = useMemo<HintsContextValue>(
		() => ({
			current,
			focusScreen,
			isShowing,
			isSplashVisible,
			isPlaced,
			isWelcomePending,
			next,
			position,
			rects,
			registerTarget,
			resetHints
		}),
		[
			current,
			focusScreen,
			isPlaced,
			isShowing,
			isSplashVisible,
			isWelcomePending,
			next,
			position,
			rects,
			registerTarget,
			resetHints
		]
	);

	return <HintsContext.Provider value={value}>{children}</HintsContext.Provider>;
};

/** The hints' state and controls. Throws outside `HintsProvider` rather than doing nothing. */
export const useHintsContext = () => {
	const context = useContext(HintsContext);

	if (context === null) {
		throw new Error('useHintsContext must be used inside HintsProvider.');
	}

	return context;
};
