import { WELCOME_HINT_ID, type Hint, type HintScreen, type HintTargetId } from './hints';

/**
 * A measured target, in window coordinates — what the spotlight cuts out of the scrim.
 *
 * `radius` lets a target say its own shape: a bar glyph on iOS is a **disc**, and a rounded
 * square around it reads as a second control behind the first. `canScroll` says the target sits
 * in a scroll view that brings it into view when its hint is shown (`HintScrollProvider`), so
 * being below the fold does not make it wait.
 */
export type HintRect = { x: number; y: number; width: number; height: number; radius?: number; canScroll?: boolean };

/** What keeps every hint back. Any one of them is enough. */
export type HintBlockers = {
	/** The animated splash is still up. */
	isSplashVisible: boolean;
	/** A bottom sheet or a menu is open — What's New included, which is a sheet. */
	isOverlayOpen: boolean;
	/** A live reading is on. */
	isLive: boolean;
	isKeyboardUp: boolean;
};

export type HintQueueInput = {
	hints: readonly Hint[];
	seenIds: ReadonlySet<string>;
	isEnabled: boolean;
	/** The screen in front of the reader, or `null` while none has said. */
	screen: HintScreen | null;
	rects: Partial<Record<HintTargetId, HintRect>>;
	window: { width: number; height: number };
	blockers: HintBlockers;
};

export const isHintBlocked = (blockers: HintBlockers) =>
	blockers.isSplashVisible || blockers.isOverlayOpen || blockers.isLive || blockers.isKeyboardUp;

/**
 * Whether a target can be pointed at: laid out, and its top edge inside the window — or in a
 * scroll view that will bring it there. A target pushed off the side by a screen transition, or
 * below the fold of a screen that cannot scroll it in, waits.
 */
export const isTargetVisible = (rect: HintRect | undefined, window: { width: number; height: number }) => {
	if (rect === undefined || rect.width <= 0 || rect.height <= 0) {
		return false;
	}

	if (rect.x < 0 || rect.x >= window.width) {
		return false;
	}

	return rect.canScroll === true || (rect.y >= 0 && rect.y < window.height);
};

/**
 * The sequence to play now, in order — empty when there is nothing to show.
 *
 * The focused screen's unseen hints whose targets are on screen, and its centred explainer if it
 * has one. **The welcome stands alone**: while it is unseen it is the whole of Ana sayfa's
 * sequence, and the screen's own hints follow as a sequence of their own once it is gone.
 */
export const hintQueue = ({
	blockers,
	hints,
	isEnabled,
	rects,
	screen,
	seenIds,
	window
}: HintQueueInput): readonly Hint[] => {
	if (!isEnabled || screen === null || isHintBlocked(blockers)) {
		return [];
	}

	const pending = hints
		.filter(hint => hint.screen === screen && !seenIds.has(hint.id))
		.sort((a, b) => a.order - b.order);
	const welcome = pending.find(hint => hint.id === WELCOME_HINT_ID);

	if (welcome) {
		return [welcome];
	}

	return pending.filter(hint => hint.target === null || isTargetVisible(rects[hint.target], window));
};
