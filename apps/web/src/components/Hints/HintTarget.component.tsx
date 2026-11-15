import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useHintsContext } from './Hints.context';
import { useHintScroll } from './HintScroll.context';
import type { HintTargetId } from './hints';

/**
 * What counts as in view: clear of the navigation bar at the top, and of a reader's footer and
 * the tab bar at the bottom.
 */
const VISIBLE_TOP = 100;
const VISIBLE_BOTTOM = 140;
/** How far under the scroller's top a target scrolled into view comes to rest — the design's 96. */
const SCROLL_CLEARANCE = 96;
/** At most this many frames waiting for a scrolled target to land (half a second). */
const STILL_MAX_FRAMES = 30;
/** How many frames in a row a scrolled target must hold still to count as landed. */
const STILL_FRAMES = 3;
/** Long enough for a tab switch and a header to settle before the hint's target measures again. */
const SETTLE_MS = 400;

type HintTargetProps = {
	id: HintTargetId;
	children: ReactNode;
	style?: ViewStyle;
	/** The spotlight's corner, for a target that is not a card — see `HintRect`. */
	radius?: number;
};

/**
 * Marks a piece of the UI as something a hint can point at. A hint naming it waits until it is
 * registered here and on screen.
 *
 * **`measureInWindow`, not `onLayout`'s own numbers.** `onLayout` reports a box relative to the
 * parent, and the overlay is full-screen — the two only agree on a screen with no header, no
 * inset and no scroll offset, which is no screen in this app.
 *
 * **Focus, not mount, is what decides whether a rectangle is live.** The tabs are not lazy and
 * Profil is pushed *inside* a tab, so Ana sayfa stays mounted behind whatever is on top of it.
 * Blur is the honest signal that the thing being pointed at is no longer in front of anyone.
 *
 * **And it re-measures when its hint comes up, not only on layout.** `onLayout` fires when this
 * view's own box changes, which is not the same as this view having moved: Ana sayfa's streak
 * card arrives *above* the group rows, pushing them down without altering their box inside the
 * scroller, and a header's safe area landing moves the Cevşen reader's strip the same way.
 *
 * **A target below the fold brings itself into view** when its hint is the one shown, inside a
 * screen that handed its scroll view over (`HintScrollProvider`): the Hizb reader's counter sits
 * under a page of text. It scrolls once per hint and is measured again where it landed.
 *
 * **And once more when its hint has settled.** A header's bar item is placed by UIKit after React
 * has laid it out, which moves it without touching its own box.
 */
export const HintTarget = ({ children, id, radius, style }: HintTargetProps) => {
	const { current, registerTarget } = useHintsContext();
	const isFocused = useIsFocused();
	const hintScroll = useHintScroll();
	const { height: windowHeight } = useWindowDimensions();
	const ref = useRef<View | null>(null);
	// The hint this target last scrolled itself into view for — once each, never in a loop.
	const scrolledForHint = useRef<string | null>(null);
	// Waiting for a scroll to land: nothing else measures meanwhile, or a layout pass mid-scroll
	// would place the card at a passing position.
	const isLanding = useRef(false);
	const currentId = current?.id ?? null;
	const isCurrent = current?.target === id;
	const canScroll = hintScroll !== null;

	/*
	 * A measurement taken while this target's hint is up says so (`currentId`): the card waits for
	 * that one, so it never shows beside where the target was before it scrolled into view.
	 */
	const register = useCallback(
		(x: number, y: number, width: number, height: number) =>
			registerTarget(
				id,
				{
					height,
					width,
					x,
					y,
					...(radius === undefined ? {} : { radius }),
					...(canScroll ? { canScroll } : {})
				},
				isCurrent ? currentId : null
			),
		[canScroll, currentId, id, isCurrent, radius, registerTarget]
	);

	const measure = useCallback(() => {
		if (!isFocused || isLanding.current) {
			return;
		}

		ref.current?.measureInWindow((x, y, width, height) => {
			if (width === 0 && height === 0) {
				return;
			}

			const scroll = hintScroll?.scrollRef.current;
			const inner = hintScroll?.innerRef.current;
			/*
			 * **Where the target lands, once it has moved and stopped.** Two frames agreeing is not
			 * enough on its own: the scroll may not have started yet, and the card was placed at the
			 * spot the target was scrolling away from. So it waits until the target has left its
			 * starting place and held still for a few frames — or, where the scroll could not move it,
			 * until the frames run out.
			 */
			const registerWhenStill = (previousY: number, stillFrames: number, framesLeft: number) => {
				requestAnimationFrame(() =>
					ref.current?.measureInWindow((left, nextY, boxWidth, boxHeight) => {
						const still = Math.abs(nextY - previousY) <= 0.5 ? stillFrames + 1 : 0;
						const hasMoved = Math.abs(nextY - y) > 0.5;

						if (framesLeft > 0 && !(hasMoved && still >= STILL_FRAMES)) {
							registerWhenStill(nextY, still, framesLeft - 1);

							return;
						}

						isLanding.current = false;
						register(left, nextY, boxWidth, boxHeight);
					})
				);
			};

			const scrollIntoView = () => {
				if (!scroll || !inner || !ref.current) {
					return;
				}

				scrolledForHint.current = currentId;
				isLanding.current = true;
				ref.current.measureLayout(inner, (_left, top) => {
					scroll.scrollTo({ animated: false, y: Math.max(0, top - SCROLL_CLEARANCE) });
					registerWhenStill(y, 0, STILL_MAX_FRAMES);
				});
			};

			if (!isCurrent || !scroll || !inner || scrolledForHint.current === currentId) {
				register(x, y, width, height);

				return;
			}

			/*
			 * Hidden means outside **the scroll view's own window**, not the screen's: a reader's footer
			 * sits over the bottom of the screen, and a counter behind it is on screen yet unseen.
			 */
			// A scroll view is a native view like any other; its type only leaves `measureInWindow` out.
			(scroll as unknown as View).measureInWindow((_sx, scrollY, _sw, scrollHeight) => {
				const top = Math.max(VISIBLE_TOP, scrollY);
				const bottom = Math.min(windowHeight - VISIBLE_BOTTOM, scrollY + scrollHeight);

				if (y < top || y + height > bottom) {
					scrollIntoView();

					return;
				}

				register(x, y, width, height);
			});
		});
	}, [currentId, hintScroll, isCurrent, isFocused, register, windowHeight]);

	useEffect(() => {
		if (!isFocused) {
			registerTarget(id, null);
			return;
		}

		measure();
	}, [currentId, id, isFocused, measure, registerTarget]);

	useEffect(() => {
		if (!isCurrent) {
			return;
		}

		// Once more when the hint has settled — and free to scroll again: a reader can reset its own
		// scroll as its page lands, which put the counter back behind the footer after the first scroll.
		const timer = setTimeout(() => {
			scrolledForHint.current = null;
			measure();
		}, SETTLE_MS);

		return () => clearTimeout(timer);
	}, [isCurrent, measure]);

	useEffect(() => () => registerTarget(id, null), [id, registerTarget]);

	return (
		<View collapsable={false} onLayout={measure} ref={ref} {...(style ? { style } : {})}>
			{children}
		</View>
	);
};
