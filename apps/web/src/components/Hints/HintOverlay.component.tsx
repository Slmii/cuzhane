import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HintCard, type HintArrow } from './HintCard.component';
import type { HintRect } from './hintQueue';
import { useHintsContext } from './Hints.context';
import { WELCOME_HINT_ID } from './hints';
import { HintWelcomeCard } from './HintWelcomeCard.component';

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
/** How dim the screen goes: the spotlight's scrim and the centred card's are the same. */
const SCRIM = 0.58;
/** Far enough past any screen's corner that the shadow reads as a full-bleed scrim. */
const SCRIM_SPREAD = 2000;
/** The design's own `.35s ease`: the card's arrival. */
const MOVE_MS = 350;
/**
 * How long a card waits for its target to measure itself before showing anyway — a target that
 * went away must not leave the app under a scrim with no card.
 */
const PLACE_TIMEOUT_MS = 1500;

/**
 * The card's arrival, as a Reanimated CSS animation on one flat style object — declared out here
 * rather than in `StyleSheet.create`, whose types reject these properties. Inside a style *array*
 * Reanimated never sees it, which is the trap `CellGrid` records.
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
 * The hint on screen, drawn over the live app: a scrim with a hole around its target and the card
 * beside it, or — for the welcome — a centred card.
 *
 * **An ordinary view over the navigator, not a `Modal`.** Rendered *beside* the navigator it dims
 * the tab bar well enough, and a modal is a separate UIWindow with its own touch routing.
 *
 * **The hole is the design's own `box-shadow`.** One view with a 2000px shadow spread is the
 * scrim, the hole and the hairline ring at once, and costs a frame nothing; an SVG mask that
 * animated re-composited the whole screen every frame.
 *
 * **The backdrop is a sibling, never a parent, and nothing wraps the card.** A `Pressable` around
 * the card to stop taps reaching the backdrop was a lid on its controls. Ordering alone does the
 * job: a tap cannot reach a view it is not inside.
 */
export const HintOverlay = () => {
	const { current, isPlaced, isShowing, next, position, rects } = useHintsContext();
	const { theme } = useThemeContext();
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const isReducedMotion = useReducedMotion();
	// Measured, because which side of its target the card fits on depends on how tall it is.
	const [cardHeight, setCardHeight] = useState(0);

	/*
	 * **Android's back button is a second way into the app underneath**, and `HintBlocker` does
	 * not cover it: back is a system gesture, and it popped the screen the card was describing.
	 * Swallowed rather than wired to the card — its button is the way on.
	 */
	useEffect(() => {
		if (!isShowing) {
			return;
		}

		const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);

		return () => subscription.remove();
	}, [isShowing]);

	// The hint that waited its full time for a target that never placed itself.
	const [timedOutId, setTimedOutId] = useState<string | null>(null);
	const currentId = current?.id ?? null;

	useEffect(() => {
		if (!isShowing || isPlaced || currentId === null) {
			return;
		}

		const timer = setTimeout(() => setTimedOutId(currentId), PLACE_TIMEOUT_MS);

		return () => clearTimeout(timer);
	}, [currentId, isPlaced, isShowing]);

	const isReady = isPlaced || (currentId !== null && timedOutId === currentId);
	// No hole and no card until the target is where it will stay: one below the fold scrolls first.
	const rect: HintRect | undefined = current?.target && isReady ? rects[current.target] : undefined;

	if (!isShowing || current === null) {
		return null;
	}

	/*
	 * **Where the card goes is the design's own rule: beside its target, with an arrow.** Below
	 * when it fits, above when it does not, and only when neither side has room is it pinned low,
	 * with no arrow. A target that has gone takes that pinned place too.
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
	const arrow: HintArrow | null =
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
			 * The plain scrim, while there is no hole to cut: a centred card, or a target still landing.
			 * The hole's own shadow is the scrim otherwise.
			 */}
			{rect ? null : (
				<View
					pointerEvents='none'
					style={[styles.fill, { backgroundColor: toAlphaColor(theme.colors.scrim, SCRIM) }]}
				/>
			)}

			{/*
			 * **A blocker, not a dismiss.** A tap beside the card does nothing; its button is the
			 * way on. A bare `View` is not a blocker — React Native's responder search walks past a
			 * view that has claimed nothing — so this one claims the touch and drops it. `HintBlocker`
			 * is the guarantee; this one covers a tap inside the cut-out, on the very control the
			 * hint is pointing at.
			 */}
			<View onStartShouldSetResponder={() => true} style={StyleSheet.absoluteFill} />

			{/*
			 * The scrim, the cut-out and the hairline ring, in one view; the ring sits on the scrim.
			 * **Drawn at the target's box, not animated there.** A glide started from JS sometimes did
			 * not run, and left the hole where the last target had been — or never faded it in.
			 */}
			{rect ? (
				<View
					pointerEvents='none'
					style={[
						styles.spotlight,
						{
							borderColor: toAlphaColor(theme.colors.onHeaderSurface, 0.85),
							borderRadius: rect.radius ?? SPOTLIGHT_RADIUS,
							boxShadow: `0 0 0 ${SCRIM_SPREAD}px ${toAlphaColor(theme.colors.scrim, SCRIM)}`,
							height: rect.height + SPOTLIGHT_PADDING * 2,
							left: rect.x - SPOTLIGHT_PADDING,
							top: rect.y - SPOTLIGHT_PADDING,
							width: rect.width + SPOTLIGHT_PADDING * 2
						}
					]}
				/>
			) : null}

			{!isReady ? null : current.target === null ? (
				<Animated.View
					key={current.id}
					style={{
						...styles.cardWrap,
						// The welcome in the middle; a page's explainer low, where a card with nothing to point at sits.
						...(current.id === WELCOME_HINT_ID ? styles.centred : { bottom: bottomLimit + 72 }),
						...(isReducedMotion ? null : cardEntrance)
					}}
				>
					{/* The welcome has its own card; a screen's explainer is a hint card with nothing to point at. */}
					{current.id === WELCOME_HINT_ID ? (
						<HintWelcomeCard hint={current} onPress={next} />
					) : (
						<HintCard arrow={null} hint={current} onNext={next} position={position} />
					)}
				</Animated.View>
			) : (
				<Animated.View
					key={`${current.id}-${placement}`}
					onLayout={event => setCardHeight(event.nativeEvent.layout.height)}
					style={{ ...styles.cardWrap, ...cardPosition, ...(isReducedMotion ? null : cardEntrance) }}
				>
					<HintCard arrow={arrow} hint={current} onNext={next} position={position} />
				</Animated.View>
			)}
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
