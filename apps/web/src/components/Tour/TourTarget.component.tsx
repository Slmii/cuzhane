import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useTour } from './Tour.context';
import { useTourScroll } from './TourScroll.context';
import type { TourTargetId } from './tourSteps';

/**
 * What counts as in view: clear of the navigation bar at the top, and of a reader's footer and
 * the tab bar at the bottom.
 */
const VISIBLE_TOP = 100;
const VISIBLE_BOTTOM = 140;
/** How far under the scroller's top a target scrolled into view comes to rest — the design's 96. */
const SCROLL_CLEARANCE = 96;
/** Long enough for a tab switch and a header to settle before the stop's target measures again. */
const SETTLE_MS = 400;

type TourTargetProps = {
	id: TourTargetId;
	children: ReactNode;
	style?: ViewStyle;
	/** The spotlight's corner, for a target that is not a card — see `TourRect`. */
	radius?: number;
};

/**
 * Marks a piece of the UI as something the tour can point at.
 *
 * **`measureInWindow`, not `onLayout`'s own numbers.** `onLayout` reports a box relative to the
 * parent, and the scrim is a full-screen `Modal` — the two only agree on a screen with no
 * header, no inset and no scroll offset, which is no screen in this app. `measureInWindow` is
 * the only measurement in the same coordinate space the overlay draws in.
 *
 * **Focus, not mount, is what decides whether a rectangle is live.** Unmounting looked like the
 * obvious moment to withdraw one and is almost never reached: the tabs are not lazy and Profil
 * is pushed *inside* a tab, so Ana sayfa stays mounted behind whatever is on top of it. A rect
 * withdrawn only on unmount meant replaying the tour from Profil cut a hole over Profil at Ana
 * sayfa's coordinates. Blur is the honest signal that the thing being pointed at is no longer
 * in front of anyone.
 *
 * **And it re-measures when the tour opens, not only on layout.** `onLayout` fires when this
 * view's own box changes, which is not the same as this view having moved: Ana sayfa's streak
 * card is absent until the stats land, and it arrives *above* the group rows, pushing them down
 * without altering their box inside the scroller. Measuring again at the moment a rect is
 * actually needed is what keeps the spotlight off the gap the card left behind.
 *
 * **And again at every step**, for the same reason one screen later: the Cevşen reader's strip
 * is measured as the reader lays out, before its top inset lands, and the header's safe area
 * moving it down leaves its own box untouched — its stop cut the hole a status bar too high.
 *
 * **A target below the fold brings itself into view** when it is the stop being shown, inside a
 * screen that handed its scroll view over (`TourScrollProvider`): the Hizb reader's counter sits
 * under a page of text, and the spotlight would otherwise frame the tab bar. It scrolls once per
 * stop, to stand `SCROLL_CLEARANCE` under the scroller's top as the design's tour does, and is
 * measured again where it landed.
 *
 * **And once more when its stop has settled.** A header's bar item is placed by UIKit after React
 * has laid it out, which moves it without touching its own box — measured as the tab switched in,
 * T3's + came out at its offset inside the bar, at the top left of the screen.
 */
export const TourTarget = ({ children, id, radius, style }: TourTargetProps) => {
	const { isActive, registerTarget, run, stepIndex } = useTour();
	const isFocused = useIsFocused();
	const tourScroll = useTourScroll();
	const { height: windowHeight } = useWindowDimensions();
	const ref = useRef<View | null>(null);
	// The stop this target last scrolled itself into view for — once each, never in a loop.
	const scrolledForStep = useRef<number | null>(null);
	const isCurrent = isActive && run[stepIndex]?.target === id;

	const register = useCallback(
		(x: number, y: number, width: number, height: number) =>
			registerTarget(id, { height, width, x, y, ...(radius === undefined ? {} : { radius }) }),
		[id, radius, registerTarget]
	);

	const measure = useCallback(() => {
		if (!isFocused) {
			return;
		}

		ref.current?.measureInWindow((x, y, width, height) => {
			if (width === 0 && height === 0) {
				return;
			}

			const scroll = tourScroll?.scrollRef.current;
			const inner = tourScroll?.innerRef.current;
			const scrollIntoView = () => {
				if (!scroll || !inner || !ref.current) {
					return;
				}

				scrolledForStep.current = stepIndex;
				ref.current.measureLayout(inner, (_left, top) => {
					scroll.scrollTo({ animated: false, y: Math.max(0, top - SCROLL_CLEARANCE) });
					// A frame for the scroll to land, then where the target now is.
					requestAnimationFrame(() => ref.current?.measureInWindow(register));
				});
			};

			if (!isCurrent || !scroll || !inner || scrolledForStep.current === stepIndex) {
				register(x, y, width, height);

				return;
			}

			/*
			 * Hidden means outside **the scroll view's own window**, not the screen's: a reader's footer
			 * sits over the bottom of the screen, and a counter behind it is on screen yet unseen — the
			 * spotlight landed on the footer instead.
			 */
			scroll.measureInWindow((_sx, scrollY, _sw, scrollHeight) => {
				const top = Math.max(VISIBLE_TOP, scrollY);
				const bottom = Math.min(windowHeight - VISIBLE_BOTTOM, scrollY + scrollHeight);

				if (y < top || y + height > bottom) {
					scrollIntoView();

					return;
				}

				register(x, y, width, height);
			});
		});
	}, [isCurrent, isFocused, register, stepIndex, tourScroll, windowHeight]);

	useEffect(() => {
		if (!isFocused) {
			registerTarget(id, null);
			return;
		}

		measure();
	}, [id, isActive, isFocused, measure, registerTarget, stepIndex]);

	useEffect(() => {
		if (!isCurrent) {
			return;
		}

		// Once more when the stop has settled — and free to scroll again: a reader can reset its own
		// scroll as its page lands, which put the counter back behind the footer after the first scroll.
		const timer = setTimeout(() => {
			scrolledForStep.current = null;
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
