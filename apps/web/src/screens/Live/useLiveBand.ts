import { type LiveMarkStore, useLiveMark } from '@/lib/hooks/useLiveSession';
import type { LiveMark } from '@/lib/types/domain';
import { LiveBand, type BandRect } from '@/screens/Live/LiveBand.component';
import type { useFreeReaderLive } from '@/screens/Live/useFreeReaderLive';
import { createElement, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Easing } from 'react-native';

/**
 * "Göster" in a reader — what every reader shares, whatever it draws: the band layer, the
 * follower's screen keeping the band in view, and the reader's side of setting and clearing it.
 * Each reader brings only its own geometry: `rectsFor` turns a line into band pieces in its scroll
 * content, or null when the line is not on what it is showing.
 */

/** How the reader's scroll view stands right now — kept in refs by the reader, read here. */
export type ScrollMetrics = { scrollY: number; viewport: number; content: number };

/* The design's measures (Birlikte oku v2, R1 and "Ekrandaki yeri"). */
/** The band's top sits a third of the way down the screen, so the line before it stays in view. */
const BAND_ANCHOR = 1 / 3;
/** While the band stays between these, the screen does not move. */
const CALM_TOP = 0.18;
const CALM_BOTTOM = 0.72;
const SCROLL_MS = 350;
const SCROLL_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

const spanOf = (pieces: BandRect[]) => ({
	bottom: Math.max(...pieces.map(piece => piece.y + piece.h)),
	top: Math.min(...pieces.map(piece => piece.y))
});

/** Where to scroll so the band sits on the third line — or null while it is inside the calm zone. */
export const bandScrollTarget = (pieces: BandRect[], metrics: ScrollMetrics): number | null => {
	if (pieces.length === 0) {
		return null;
	}

	const { bottom, top } = spanOf(pieces);
	const { content, scrollY, viewport } = metrics;

	if (top >= scrollY + CALM_TOP * viewport && bottom <= scrollY + CALM_BOTTOM * viewport) {
		return null;
	}

	return Math.round(Math.max(0, Math.min(content - viewport, top - viewport * BAND_ANCHOR)));
};

/** Whether any of the band is on the screen. */
export const isBandOnScreen = (pieces: BandRect[], metrics: ScrollMetrics) => {
	if (pieces.length === 0) {
		return false;
	}

	const { bottom, top } = spanOf(pieces);

	return bottom > metrics.scrollY && top < metrics.scrollY + metrics.viewport;
};

type BandLayerProps = {
	store: LiveMarkStore;
	rectsFor: (mark: LiveMark) => BandRect[] | null;
	tone: 'follower' | 'own';
	isOverImage?: boolean;
	/** Bumped by the reader when its layout changes, so the same line is measured again. */
	layoutVersion: number;
};

/**
 * The band, subscribed on its own. **The reader never re-renders for a line** — a tap, a drag or a
 * follower's update reaches this layer alone, never the Arabic beside it.
 */
export const LiveBandLayer = ({ isOverImage = false, layoutVersion, rectsFor, store, tone }: BandLayerProps) => {
	const { isFresh, mark } = useLiveMark(store);
	// `layoutVersion` is read so a re-measured page redraws the same line in its new place.
	const pieces = mark && layoutVersion >= 0 ? rectsFor(mark) ?? [] : [];

	return createElement(LiveBand, { isFresh, isOverImage, pieces, tone });
};

type Live = ReturnType<typeof useFreeReaderLive>;

type FollowArgs = {
	live: Live;
	rectsFor: (mark: LiveMark) => BandRect[] | null;
	metricsRef: RefObject<ScrollMetrics>;
	scrollTo: (y: number) => void;
	isReducedMotion: boolean;
};

/**
 * A follower's screen and the band.
 *
 * - **While the reader has their line on screen, the band leads**: the follower's screen keeps it
 *   on the third line, moving (350 ms) only when it leaves the calm zone, and the reader's scroll
 *   fraction is ignored. Once the reader scrolls away from it, the page fraction leads again.
 * - **Detached, the screen stays put** while the band keeps moving; `direction` tells the "Takip et"
 *   button which way the band went.
 *
 * `drivesScroll` is what the reader's own position handler asks before applying a fraction.
 */
export const useLiveBandFollow = ({ isReducedMotion, live, metricsRef, rectsFor, scrollTo }: FollowArgs) => {
	const { isFollower, markStore } = live;
	const isDetached = live.state.isDetached;
	const [direction, setDirection] = useState<'up' | 'down'>('down');
	const tweenRef = useRef(0);
	const targetRef = useRef<number | null>(null);

	const stopScroll = useCallback(() => {
		cancelAnimationFrame(tweenRef.current);
		tweenRef.current = 0;
		targetRef.current = null;
	}, []);

	// A short eased scroll the reader's own thread runs — the design's 350 ms, which no native
	// `scrollTo` lets us choose. Reduce Motion jumps.
	const glideTo = useCallback(
		(target: number) => {
			if (targetRef.current === target) {
				return;
			}

			stopScroll();
			targetRef.current = target;

			const from = metricsRef.current.scrollY;

			if (isReducedMotion || Math.abs(target - from) < 1) {
				scrollTo(target);
				targetRef.current = null;
				return;
			}

			const startedAt = Date.now();
			const step = () => {
				const progress = Math.min(1, (Date.now() - startedAt) / SCROLL_MS);

				scrollTo(from + (target - from) * SCROLL_EASING(progress));
				tweenRef.current = progress < 1 ? requestAnimationFrame(step) : 0;

				if (progress >= 1) {
					targetRef.current = null;
				}
			};

			tweenRef.current = requestAnimationFrame(step);
		},
		[isReducedMotion, metricsRef, scrollTo, stopScroll]
	);

	const piecesNow = useCallback(() => {
		const { mark } = markStore.get();

		return mark ? rectsFor(mark) : null;
	}, [markStore, rectsFor]);

	/** True while the band, not the reader's fraction, decides where the follower's screen is. */
	const drivesScroll = useCallback(() => {
		const { shown } = markStore.get();
		const pieces = piecesNow();

		return shown && pieces !== null && pieces.length > 0;
	}, [markStore, piecesNow]);

	const updateDirection = useCallback(() => {
		const pieces = piecesNow();

		if (!pieces || pieces.length === 0) {
			return;
		}

		setDirection(spanOf(pieces).bottom < metricsRef.current.scrollY ? 'up' : 'down');
	}, [metricsRef, piecesNow]);

	/** Brings the band to its place now — on a new line, on "Takip et", or once the page has laid out. */
	const bringIntoView = useCallback(() => {
		// Let go, or the band no longer leads: a glide must not fight the page's own scroll.
		if (isDetached || !drivesScroll()) {
			stopScroll();
			return false;
		}

		const target = bandScrollTarget(piecesNow() ?? [], metricsRef.current);

		if (target !== null) {
			glideTo(target);
		}

		return true;
	}, [drivesScroll, glideTo, isDetached, metricsRef, piecesNow, stopScroll]);

	useEffect(() => {
		if (!isFollower) {
			return undefined;
		}

		/*
		 * Detached, nothing of the band moves the screen — a glide under way stops with it, page
		 * buttons included. Following again ("Takip et"), the line already showing is brought into
		 * view at once rather than at its next change.
		 */
		if (isDetached) {
			stopScroll();
			updateDirection();
		} else {
			bringIntoView();
		}

		return markStore.subscribe(() => {
			if (isDetached) {
				updateDirection();
				return;
			}

			bringIntoView();
		});
	}, [bringIntoView, isDetached, isFollower, markStore, stopScroll, updateDirection]);

	useEffect(() => stopScroll, [stopScroll]);

	return {
		bringIntoView,
		direction,
		drivesScroll,
		/** The follower took the page: a glide still running must not pull it back. */
		onDragStart: stopScroll,
		/**
		 * Every scroll, the band's own glides included — so it only keeps the arrow pointing at the
		 * band, and never stops anything.
		 */
		onScroll: useCallback(() => {
			if (isDetached) {
				updateDirection();
			}
		}, [isDetached, updateDirection])
	};
};

type LeadArgs = {
	live: Live;
	rectsFor: (mark: LiveMark) => BandRect[] | null;
	metricsRef: RefObject<ScrollMetrics>;
};

/**
 * The reader's side: a tap sets their line (and flashes their own band); scrolling it off their
 * screen tells followers to follow the page again, and back on, the band again. A new bab or page
 * clears it — the reader calls `clear` when it turns.
 */
export const useLiveBandLead = ({ live, metricsRef, rectsFor }: LeadArgs) => {
	const { isLeader, markStore, publishMark } = live;

	/*
	 * A tap sets the line; it goes three seconds after the last tap (`LINE_SHOWN_MS`) — a rule the
	 * session keeps, so it holds even if the reader leaves this screen meanwhile.
	 */
	const point = useCallback(
		(mark: LiveMark) => {
			if (isLeader) {
				publishMark(mark, true, { isTap: true });
			}
		},
		[isLeader, publishMark]
	);

	const clear = useCallback(() => {
		if (isLeader && markStore.get().mark !== null) {
			publishMark(null, false);
		}
	}, [isLeader, markStore, publishMark]);

	/** Called on every scroll of the reader's: only a change of on-screen-ness is sent. */
	const onScroll = useCallback(() => {
		const { mark, shown } = markStore.get();

		if (!isLeader || !mark) {
			return;
		}

		const pieces = rectsFor(mark);
		const isShown = pieces !== null && isBandOnScreen(pieces, metricsRef.current);

		if (isShown !== shown) {
			publishMark(mark, isShown);
		}
	}, [isLeader, markStore, metricsRef, publishMark, rectsFor]);

	return { clear, onScroll, point };
};
