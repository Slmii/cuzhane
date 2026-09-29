import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTour, type TourRect } from './Tour.context';
import { TourCenterCard } from './TourCenterCard.component';
import { TourEndSheet } from './TourEndSheet.component';
import { TourStepCard, type TourArrow } from './TourStepCard.component';
import { legPosition } from './tourSteps';
import { useTourNavigation } from './useTourNavigation';

/** How far the cut-out stands off the element it frames, and how round its corners are. */
const SPOTLIGHT_PADDING = 6;
const SPOTLIGHT_RADIUS = 18;
/** The card's distance from the element it points at, and from the screen's sides. */
const CARD_GAP = 16;
const CARD_INSET = 18;
/** The arrow's half-width, and how close it may come to the card's left and right corners. */
const ARROW_HALF = 7;
const ARROW_MIN_LEFT = 16;
const ARROW_MIN_RIGHT = 22;
/** The card's height before it has been measured — the design's own guess. */
const CARD_HEIGHT_GUESS = 210;
/** How dim the screen goes: the spotlight's scrim and the centred cards' are the same. */
const SCRIM = 0.58;
/** Far enough past any screen's corner that the shadow reads as a full-bleed scrim. */
const SCRIM_SPREAD = 2000;
/** The design's own `.35s ease`, shared by the hole that moves and the card that follows it. */
const MOVE_MS = 350;

/**
 * The card's arrival, as a Reanimated CSS animation on one flat style object — declared out here
 * rather than in `StyleSheet.create`, whose types reject these properties, exactly as
 * `ui/MenuAction` declares its panel's. Inside a style *array* Reanimated never sees it, which is
 * the trap `CellGrid` records.
 */
const CARD_KEYFRAMES = {
	'0%': { opacity: 0, transform: [{ translateY: 8 }] },
	'100%': { opacity: 1, transform: [{ translateY: 0 }] }
} as const;

const cardEntrance = {
	animationDuration: MOVE_MS,
	animationFillMode: 'both' as const,
	animationName: CARD_KEYFRAMES,
	animationTimingFunction: 'ease'
};

/**
 * Section T, drawn over the live app.
 *
 * **An ordinary view over the navigator, not a `Modal`.** A modal was the first answer, on the
 * grounds that the bottom bar is a real UIKit tab bar and nothing inside the navigator draws over
 * it — and that premise is wrong for a view rendered *beside* the navigator rather than inside
 * one of its screens. This one dims the tab bar perfectly well (checked on the simulator), and a
 * modal is a separate UIWindow with its own touch routing, which is a liability here for no gain.
 *
 * **The hole is the design's own `box-shadow`, and it started as an SVG mask.** The prototype
 * paints scrim and hole with one view and a 2000px shadow spread; the mask was chosen over it
 * because nothing else in the app uses `boxShadow`. It worked and it was slow: a full-screen
 * `Svg` whose `Mask` rectangle animates re-composites the whole screen every frame, and the tour
 * moved between stops in visible steps. One view costs a frame nothing, and it is the scrim, the
 * hole and the design's hairline ring all at once.
 *
 * **The backdrop is a sibling, never a parent, and nothing wraps the card.** A `Pressable` around
 * the card to stop taps reaching the backdrop was a lid on its controls. Ordering alone does the
 * job — the backdrop fills the screen underneath, the card is a later sibling above it, and a tap
 * cannot reach a view it is not inside.
 */
export const TourOverlay = () => {
	const {
		askToEnd,
		back,
		finish,
		isActive,
		isBlocked,
		isConfirmingEnd,
		keepGoing,
		next,
		rects,
		run,
		skipPart,
		stepIndex
	} = useTour();
	const { theme } = useThemeContext();
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const isReducedMotion = useReducedMotion();
	// Measured, because which side of its target the card fits on depends on how tall it is.
	const [cardHeight, setCardHeight] = useState(0);

	// Takes the reader to the screen each stop is about — see `useTourNavigation`.
	useTourNavigation();

	/*
	 * **Android's back button is a second way into the app underneath, and `TourBlocker` does not
	 * cover it.** That blocker stops touches; back is a system gesture, so it popped whatever
	 * screen the stop was standing on out from under the scrim — leaving the card describing a
	 * screen nobody could see, and `currentPlace` stale, so the next stop on the same place would
	 * not navigate back to it.
	 *
	 * Swallowed rather than wired to `finish`: the tour has its own way out on every card, and
	 * back is not it.
	 */
	const isOverApp = isActive && !isBlocked;

	useEffect(() => {
		if (!isOverApp) {
			return;
		}

		const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);

		return () => subscription.remove();
	}, [isOverApp]);

	const step = run[stepIndex];
	const rect: TourRect | undefined = step?.target ? rects[step.target] : undefined;

	/*
	 * The hole glides between targets rather than cutting instantly. The design fades its
	 * spotlight out and in, which in a browser is the cheap way to hide a jump; moving the hole
	 * keeps the reader's eye on the thing being handed from one stop to the next, which is what
	 * the fade was standing in for.
	 */
	const holeX = useSharedValue(0);
	const holeY = useSharedValue(0);
	const holeWidth = useSharedValue(0);
	const holeHeight = useSharedValue(0);
	const holeOpacity = useSharedValue(0);

	useEffect(() => {
		const duration = isReducedMotion ? 0 : MOVE_MS;
		const easing = Easing.bezier(0.2, 0.9, 0.3, 1);
		const isFirstHole = holeOpacity.value === 0;

		if (!rect) {
			holeOpacity.value = withTiming(0, { duration, easing });
			return;
		}

		const target = {
			height: rect.height + SPOTLIGHT_PADDING * 2,
			width: rect.width + SPOTLIGHT_PADDING * 2,
			x: rect.x - SPOTLIGHT_PADDING,
			y: rect.y - SPOTLIGHT_PADDING
		};

		// The first hole appears where it belongs rather than sliding in from the corner.
		if (isFirstHole) {
			holeX.value = target.x;
			holeY.value = target.y;
			holeWidth.value = target.width;
			holeHeight.value = target.height;
		} else {
			holeX.value = withTiming(target.x, { duration, easing });
			holeY.value = withTiming(target.y, { duration, easing });
			holeWidth.value = withTiming(target.width, { duration, easing });
			holeHeight.value = withTiming(target.height, { duration, easing });
		}

		holeOpacity.value = withTiming(1, { duration, easing });
	}, [holeHeight, holeOpacity, holeWidth, holeX, holeY, isReducedMotion, rect]);

	/*
	 * One view is the scrim, the hole and the ring. `boxShadow` paints everything outside its
	 * rounded box, so the box *is* the cut-out — nothing is masked and nothing re-composites.
	 */
	const spotlightStyle = useAnimatedStyle(() => ({
		height: holeHeight.value,
		left: holeX.value,
		opacity: holeOpacity.value,
		top: holeY.value,
		width: holeWidth.value
	}));

	// Its counterweight: the plain scrim a stop with nothing to point at gets. The two cross-fade
	// on one value, so moving between a spotlit stop and a centred one has no seam.
	const plainScrimStyle = useAnimatedStyle(() => ({ opacity: 1 - holeOpacity.value }));

	if (!isActive || isBlocked || step === undefined) {
		return null;
	}

	const isSpot = step.kind === 'spot';

	/*
	 * **Where the card goes is the design's own rule (section T): beside its target, with an
	 * arrow.** Below when it fits, above when it does not, and only when neither side has room is
	 * it pinned low, with no arrow — an arrow from there would point at nothing in particular.
	 * A stop whose target has not laid out yet takes that pinned place until it has.
	 *
	 * The room each side is the screen less its safe areas. The design keeps a "Turu geç" pill in
	 * the top right as well; the app has none — the way out is a link on the card itself.
	 */
	const hole = rect && {
		bottom: rect.y + rect.height + SPOTLIGHT_PADDING,
		right: rect.x + rect.width + SPOTLIGHT_PADDING,
		top: rect.y - SPOTLIGHT_PADDING,
		x: rect.x - SPOTLIGHT_PADDING
	};
	const topLimit = insets.top + 12;
	const bottomLimit = insets.bottom + 24;
	const height = cardHeight || CARD_HEIGHT_GUESS;
	const placement = !hole
		? 'pinned'
		: windowHeight - bottomLimit - (hole.bottom + CARD_GAP) >= height
		? 'below'
		: hole.top - CARD_GAP - topLimit >= height
		? 'above'
		: 'pinned';
	const cardPosition =
		!hole || placement === 'pinned'
			? { bottom: bottomLimit + 72 }
			: placement === 'below'
			? { top: hole.bottom + CARD_GAP }
			: { bottom: windowHeight - hole.top + CARD_GAP };
	const arrow: TourArrow | null =
		!hole || placement === 'pinned'
			? null
			: {
					edge: placement === 'below' ? 'top' : 'bottom',
					// Under the target's centre, kept clear of the card's rounded corners.
					left: Math.max(
						ARROW_MIN_LEFT,
						Math.min(
							windowWidth - CARD_INSET * 2 - ARROW_MIN_RIGHT,
							(hole.x + hole.right) / 2 - CARD_INSET - ARROW_HALF
						)
					)
			  };

	return (
		<View style={styles.root}>
			{/*
			 * **First, so it is hit-tested last.** It is transparent to touches anyway, being
			 * `pointerEvents='none'`, and the backdrop below it is transparent to the eye — so
			 * the order costs nothing either way and this one cannot be got wrong.
			 */}
			<Animated.View
				pointerEvents='none'
				style={[styles.fill, plainScrimStyle, { backgroundColor: toAlphaColor(theme.colors.scrim, SCRIM) }]}
			/>

			{/*
			 * **A blocker, not a dismiss.** A stray tap beside the card must not throw the tour
			 * away; the card's own links are the way out, and "Turu geç" asks first. A bare `View` is not a blocker —
			 * React Native's responder search walks past a view that has claimed nothing — so this
			 * one answers `onStartShouldSetResponder` and does nothing with the touch.
			 *
			 * It is not the guarantee, though — `TourBlocker` is. This one covers what that cannot:
			 * a tap inside the cut-out, on the very control the stop is pointing at.
			 */}
			<View onStartShouldSetResponder={() => true} style={StyleSheet.absoluteFill} />

			{/*
			 * The scrim, the cut-out and the design's hairline ring, in one view. The border is
			 * light in both themes: it sits on the scrim, not on the page.
			 */}
			<Animated.View
				pointerEvents='none'
				style={[
					styles.spotlight,
					spotlightStyle,
					{
						borderColor: toAlphaColor(theme.colors.onHeaderSurface, 0.85),
						borderRadius: rect?.radius ?? SPOTLIGHT_RADIUS,
						boxShadow: `0 0 0 ${SCRIM_SPREAD}px ${toAlphaColor(theme.colors.scrim, SCRIM)}`
					}
				]}
			/>

			{isSpot ? (
				<Animated.View
					key={`${stepIndex}-${placement}`}
					onLayout={event => setCardHeight(event.nativeEvent.layout.height)}
					style={{ ...styles.cardWrap, ...cardPosition, ...(isReducedMotion ? null : cardEntrance) }}
				>
					<TourStepCard
						arrow={arrow}
						{...(stepIndex > 0 ? { onBack: back } : {})}
						onNext={next}
						// One link in the card's corner: past this part, or — at the start, which has
						// no part to skip — out of the tour.
						{...(step.leg === 'cevsen' || step.leg === 'quran' || step.leg === 'hizb'
							? { onSkipPart: skipPart }
							: { onSkipTour: askToEnd })}
						position={legPosition(run, stepIndex)}
						step={step}
					/>
				</Animated.View>
			) : (
				<Animated.View
					key={stepIndex}
					style={{ ...styles.cardWrap, ...styles.centred, ...(isReducedMotion ? null : cardEntrance) }}
				>
					<TourCenterCard
						{...(step.kind === 'intro' ? { onLater: askToEnd } : {})}
						onPrimary={next}
						step={step}
					/>
				</Animated.View>
			)}

			<TourEndSheet isVisible={isConfirmingEnd} onEnd={finish} onKeepGoing={keepGoing} />
		</View>
	);
};

const styles = StyleSheet.create({
	cardWrap: {
		left: CARD_INSET,
		position: 'absolute',
		right: CARD_INSET
	},
	centred: {
		bottom: 0,
		justifyContent: 'center',
		top: 0
	},
	fill: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	root: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	spotlight: {
		borderRadius: SPOTLIGHT_RADIUS,
		borderWidth: 1.5,
		position: 'absolute'
	}
});
