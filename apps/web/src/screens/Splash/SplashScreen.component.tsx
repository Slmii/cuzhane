import * as NativeSplash from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	makeMutable,
	useAnimatedStyle,
	useReducedMotion,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated';

/**
 * **One colour in both modes, never the theme's.** It must equal `backgroundColor` in `app.json`'s
 * `expo-splash-screen` entry and the backdrop baked into `splash.png`, or the hand-over shows. A
 * dark variant used to exist natively, and the app's theme arrives a beat after launch, so a dark
 * phone saw a black launch screen and then this green.
 */
const BRAND_GREEN = '#3E6B5C';
/** `imageWidth` of `expo-splash-screen` in `app.json` — the rosette must land where the native one was. */
const EMBLEM_SIZE = 288;

/** One full turn, once up to speed: slow enough to read as ornament, not as a spinner. */
const TURN_MS = 7000;
/**
 * The spin eases in from rest, so the first frame is the native splash exactly. A quadratic ease-in
 * over `RAMP_MS` ends at twice its average speed, so the ramp covers half of what the steady turn
 * would in that time — and so hands over to it with no change of speed.
 */
const RAMP_MS = 1600;
const RAMP_DEGREES = (360 * RAMP_MS) / TURN_MS / 2;
const BREATH_MS = 2400;
const BREATH_SCALE = 1.035;

const SOURCE = require('@/assets/splash.png');

/**
 * Module-level, not per mount: the splash mounts up to three times in a row (the update check,
 * `AppContainer`, `SplashHold`), and each starting its own spin would snap the rosette back upright
 * at every hand-over.
 */
const spin = makeMutable(0);
const breath = makeMutable(1);
let isSpinning = false;

const startMotion = () => {
	if (isSpinning) {
		return;
	}

	isSpinning = true;
	spin.value = withSequence(
		withTiming(RAMP_DEGREES, { duration: RAMP_MS, easing: Easing.in(Easing.quad) }),
		// Repeats from RAMP_DEGREES, which a full turn later is the same picture: no seam.
		withRepeat(withTiming(RAMP_DEGREES + 360, { duration: TURN_MS, easing: Easing.linear }), -1, false)
	);
	breath.value = withRepeat(
		withTiming(BREATH_SCALE, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
		-1,
		true
	);
};

/**
 * **The native splash goes only once this one's rosette is on screen.** Hidden any earlier, the
 * frame between showed the backdrop without it — a flicker. One frame after `onLoad`, so the
 * image has been drawn, not just decoded. On a failed load too, or the native splash would stay
 * up for good. Repeated calls are harmless.
 */
const hideNativeSplash = () => {
	requestAnimationFrame(() => {
		NativeSplash.hideAsync().catch(() => {});
	});
};

/**
 * A0 · Açılış.
 *
 * The native splash, held: brand green with the rosette exactly where the native screen drew it,
 * which then eases into a slow turn and a gentle breath while the app loads. The splash image's
 * backdrop is the same opaque green as the view, so the turning square's corners never show.
 */
export const SplashScreen = () => {
	const isReducedMotion = useReducedMotion();

	useEffect(() => {
		if (!isReducedMotion) {
			startMotion();
		}
	}, [isReducedMotion]);

	const emblemStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${spin.value}deg` }, { scale: breath.value }]
	}));

	return (
		<View accessibilityLabel='Cüzhane' accessible style={styles.root}>
			<Animated.Image
				fadeDuration={0}
				onError={hideNativeSplash}
				onLoad={hideNativeSplash}
				source={SOURCE}
				style={[styles.emblem, emblemStyle]}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	emblem: {
		height: EMBLEM_SIZE,
		resizeMode: 'contain',
		width: EMBLEM_SIZE
	},
	root: {
		...StyleSheet.absoluteFill,
		alignItems: 'center',
		backgroundColor: BRAND_GREEN,
		justifyContent: 'center',
		// Above the dev trigger, which sits at 9999: while the splash is up it is the only
		// thing that should be on screen.
		zIndex: 10_000
	}
});
