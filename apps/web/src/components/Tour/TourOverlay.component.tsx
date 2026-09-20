import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { navigationRef } from '@/navigation/navigationRef';
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
import { useTour, WELCOME_STEP, type TourRect } from './Tour.context';
import { TourDoneCard } from './TourDoneCard.component';
import { TourStepCard } from './TourStepCard.component';
import { TourWelcomeSheet } from './TourWelcomeSheet.component';
import { TOUR_STEPS } from './tourSteps';
import { useTourNavigation } from './useTourNavigation';

/** How far the cut-out stands off the element it frames, and how round its corners are. */
const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 18;
/** The card's distance from the element it points at, and from the screen edges. */
const CARD_GAP = 14;
const CARD_INSET = 18;
/** How dim the screen goes. The design uses a lighter scrim behind its two full-screen cards. */
const SCRIM_SPOTLIGHT = 0.58;
const SCRIM_PLAIN = 0.5;
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
 * Section O, drawn over the live app.
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
 * hole and the design's hairline ring all at once — the ring was a second view only because the
 * mask could not draw it.
 *
 * **The backdrop is a sibling, never a parent, and nothing wraps the card.** It began as a
 * `Pressable` over the whole screen with the card nested inside a second `Pressable` whose
 * `onPress` did nothing, there to stop a tap on the card reaching the backdrop. A `Pressable`
 * around a native control is a lid on it: `AppButton` is a SwiftUI `Host` here, which never joins
 * React Native's responder chain, so the wrapper claimed the responder on touch-start and the
 * touch was cancelled on its way to the button. Ordering alone does the job — the backdrop fills
 * the screen underneath, the card is a later sibling above it, and a tap cannot reach a view it
 * is not inside.
 *
 * The welcome card is not part of this at all — the design draws it as a sheet pinned to the
 * bottom edge with a grabber, so it is one. See `TourWelcomeSheet`.
 */
export const TourOverlay = () => {
	const { back, finish, isActive, isBlocked, next, rects, stepIndex } = useTour();
	const { theme } = useThemeContext();
	const { height: windowHeight } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const isReducedMotion = useReducedMotion();
	// Measured, because whether the card collides with the spotlight depends on how tall it is.
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
	 * back is not it. Registered only while the tour is over the app, so the welcome sheet keeps
	 * the platform's own dismissal.
	 */
	const isOverApp = isActive && !isBlocked && stepIndex > WELCOME_STEP;

	useEffect(() => {
		if (!isOverApp) {
			return;
		}

		const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);

		return () => subscription.remove();
	}, [isOverApp]);

	const isDone = stepIndex >= TOUR_STEPS.length;
	const step = stepIndex === WELCOME_STEP || isDone ? undefined : TOUR_STEPS[stepIndex];
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

	if (!isActive || isBlocked) {
		return null;
	}

	if (stepIndex === WELCOME_STEP) {
		return <TourWelcomeSheet onDismiss={finish} onStart={next} />;
	}

	/*
	 * **The card is pinned to the bottom, and only steps aside when it would sit on the thing it
	 * is describing.**
	 *
	 * It used to take whichever side of the spotlight was free, which put it in a different place
	 * at almost every stop: the reader's eye had to find the words again fourteen times over, and
	 * the Devam button moved out from under their thumb between taps. A fixed home is worth more
	 * than adjacency — the cut-out already says which thing is being talked about.
	 *
	 * The exception is unavoidable: a target low on the screen (the reader's action bar) would be
	 * *behind* a card pinned there. Those stops, and only those, put the card at the top. It is
	 * measured rather than guessed at from a threshold, so a stop moves only when it genuinely
	 * collides.
	 */
	const pinnedBottom = insets.bottom + CARD_INSET;
	const cardTopWhenPinned = windowHeight - pinnedBottom - cardHeight;
	const spotlightBottom = rect === undefined ? 0 : rect.y + rect.height + SPOTLIGHT_PADDING + CARD_GAP;
	const isCardAtTop = rect !== undefined && cardHeight > 0 && spotlightBottom > cardTopWhenPinned;

	const cardPosition = isCardAtTop ? { top: insets.top + CARD_INSET } : { bottom: pinnedBottom };

	/** The closing card's one way onward: end the tour, then open create-group. */
	const leaveToCreateGroup = () => {
		finish();

		if (navigationRef.isReady()) {
			// Typed loosely on purpose: create-group is a sheet route on the root stack, and the
			// overlay lives outside every navigator.
			(navigationRef.navigate as unknown as (name: string) => void)('CreateGroup');
		}
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
				style={[
					styles.plainScrim,
					plainScrimStyle,
					{ backgroundColor: toAlphaColor(theme.colors.scrim, SCRIM_PLAIN) }
				]}
			/>

			{/*
			 * **A blocker, not a dismiss.** It was a `Pressable` calling `finish`, the way every
			 * sheet in the app treats its backdrop — and a tour is not a sheet. The reader is
			 * being walked through fourteen stops and a stray tap beside the card threw the whole
			 * thing away, with the only way back a row in Profil. "Atla" is the way out, and it
			 * says so on every card.
			 *
			 * **A bare `View` is not a blocker**, which is what it was left as and what let a tap
			 * on the group row under the scrim open that group. React Native's responder search
			 * walks past a view that has claimed nothing and keeps going to whatever is under it;
			 * only a view that answers `onStartShouldSetResponder` ends the search. It claims the
			 * touch and does nothing with it, which is the whole job.
			 *
			 * It is not the guarantee, though — `TourBlocker` is, and for the reason recorded
			 * there. This one covers what that cannot: a tap inside the cut-out, on the very
			 * control the stop is pointing at.
			 */}
			<View onStartShouldSetResponder={() => true} style={StyleSheet.absoluteFill} />

			{/*
			 * The scrim, the cut-out and the design's hairline ring, in one view. The border is
			 * light in both themes, like Home's bar glyph: it sits on the scrim, not on the page,
			 * and `onAccent` goes dark when the theme does.
			 */}
			<Animated.View
				pointerEvents='none'
				style={[
					styles.spotlight,
					spotlightStyle,
					{
						borderColor: toAlphaColor(theme.colors.onHeaderSurface, 0.85),
						// A target may name its own shape — a bar glyph on iOS is a disc. See `TourRect`.
						borderRadius: rect?.radius ?? SPOTLIGHT_RADIUS,
						boxShadow: `0 0 0 ${SCRIM_SPREAD}px ${toAlphaColor(theme.colors.scrim, SCRIM_SPOTLIGHT)}`
					}
				]}
			/>

			{/*
			 * **Keyed on where the card sits, not on which stop it is showing.** It was keyed on
			 * the step, so every stop was a fresh element and replayed the entrance — which made
			 * sense while the card moved to a new place each time and is noise now that it does
			 * not. Within one anchor the words simply change; the animation is kept for the thing
			 * it is actually announcing, which is the card moving.
			 */}
			<Animated.View
				key={isDone ? 'centred' : isCardAtTop ? 'top' : 'bottom'}
				onLayout={event => setCardHeight(event.nativeEvent.layout.height)}
				style={{
					...styles.cardWrap,
					// The closing card is a conclusion rather than a pointer, so it sits centred.
					...(isDone ? styles.cardCentred : cardPosition),
					...(isReducedMotion ? null : cardEntrance)
				}}
			>
				{isDone ? (
					<TourDoneCard onClose={finish} onCreateGroup={leaveToCreateGroup} />
				) : (
					<TourStepCard
						{...(stepIndex > 0 ? { onBack: back } : {})}
						onNext={next}
						onSkip={finish}
						stepIndex={stepIndex}
					/>
				)}
			</Animated.View>
		</View>
	);
};

const styles = StyleSheet.create({
	/**
	 * A card with nothing to point at fills the height and centres itself inside it.
	 *
	 * It was `top: '50%'` with a `-50%` translate, which is the browser idiom and put "Hazırsın"
	 * noticeably above centre: a percentage translate resolves against the *animated* box, and
	 * this wrapper carries an entrance that moves it. Letting flex do the centring has nothing to
	 * resolve against and cannot drift.
	 */
	cardCentred: {
		bottom: 0,
		justifyContent: 'center',
		top: 0
	},
	cardWrap: {
		left: CARD_INSET,
		position: 'absolute',
		right: CARD_INSET
	},
	plainScrim: {
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
	},
	root: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	}
});
