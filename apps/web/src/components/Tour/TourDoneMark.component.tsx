import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedProps,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withTiming,
	type EasingFunction,
	type EasingFunctionFactory
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The design's own drawing grid. Everything below is in these units. */
const VIEW_WIDTH = 132;
const VIEW_HEIGHT = 96;

/** The size the frame draws it at: `width="264" height="192"` over a 132×96 viewBox. */
const SCALE = 2;

// CSS `ease-out`, spelled out — Reanimated's `Easing.out(...)` is a different curve.
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

type Stroke = {
	d: string;
	/** The path's length, which is also its dash and its starting offset. */
	length: number;
	duration: number;
	delay: number;
	easing?: EasingFunction | EasingFunctionFactory;
};

/**
 * The seven strokes, in the frame's own order and with its own timings. Ground first, then the
 * building rises off it, the dome over that, and the minarets last — a drawing being made rather
 * than a picture appearing.
 */
const STROKES: readonly Stroke[] = [
	{ d: 'M14 88H118', length: 104, duration: 350, delay: 100 },
	{ d: 'M22 88V66H110V88', length: 132, duration: 400, delay: 250 },
	{
		d: 'M40 66C40 44 52 34 66 26C80 34 92 44 92 66',
		length: 120,
		duration: 550,
		delay: 450,
		easing: Easing.bezier(0.4, 0, 0.2, 1)
	},
	{ d: 'M66 26V19', length: 8, duration: 180, delay: 950 },
	{ d: 'M58 88V78C58 73 62 70 66 70C70 70 74 73 74 78V88', length: 46, duration: 350, delay: 650 },
	{ d: 'M27 66V22M35 66V22M27 22L31 12L35 22', length: 110, duration: 450, delay: 750 },
	{ d: 'M97 66V22M105 66V22M97 22L101 12L105 22', length: 110, duration: 450, delay: 850 }
];

/** The crescent and the two stars: solid shapes, so they fade in where the strokes draw. */
const CRESCENT_D = 'M113 10A7.5 7.5 0 1 0 117.5 19.5A6 6 0 1 1 113 10Z';
const CRESCENT = { delay: 1200, duration: 400 };
const STARS = [
	{ cx: 19, cy: 20, r: 1.1, delay: 1400, duration: 350 },
	{ cx: 82, cy: 9, r: 1, delay: 1500, duration: 350 }
];

/**
 * The halo behind the building. It is drawn in its **own** Svg rather than in the mark's, because
 * it is wider and taller than the drawing it sits behind — the frame lets it spill with
 * `overflow: visible`, and React Native clips an `Svg` to its box instead. A second view, sized to
 * the glow and positioned by the frame's own numbers, keeps the mark's viewBox tight.
 */
const GLOW_BOX = 120;
const GLOW_RADIUS = 55;
const GLOW_CENTRE_Y = VIEW_HEIGHT * 0.58;
const GLOW_HALF_CYCLE_MS = 1600;
const GLOW_DELAY_MS = 800;

const DrawnStroke = ({ color, isStill, stroke }: { color: string; isStill: boolean; stroke: Stroke }) => {
	const offset = useSharedValue(isStill ? 0 : stroke.length);

	useEffect(() => {
		if (isStill) {
			return;
		}

		offset.value = withDelay(
			stroke.delay,
			withTiming(0, { duration: stroke.duration, easing: stroke.easing ?? EASE_OUT })
		);
	}, [isStill, offset, stroke]);

	const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

	// `fill` is set here as well as on the `Svg`: inheritance is the frame's mechanism, and an
	// explicit one is what guarantees it — a filled dome is what this looked like when it was
	// left to inherit alone.
	return (
		<AnimatedPath
			animatedProps={animatedProps}
			d={stroke.d}
			fill='none'
			stroke={color}
			strokeDasharray={stroke.length}
		/>
	);
};

/** Shared by the crescent and the stars: they arrive rather than being drawn. */
const useFadeIn = ({ delay, duration, isStill }: { delay: number; duration: number; isStill: boolean }) => {
	const opacity = useSharedValue(isStill ? 1 : 0);

	useEffect(() => {
		if (isStill) {
			return;
		}

		opacity.value = withDelay(delay, withTiming(1, { duration, easing: EASE_OUT }));
	}, [delay, duration, isStill, opacity]);

	return useAnimatedProps(() => ({ opacity: opacity.value }));
};

const Crescent = ({ color, isStill }: { color: string; isStill: boolean }) => {
	const animatedProps = useFadeIn({ ...CRESCENT, isStill });

	return <AnimatedPath animatedProps={animatedProps} d={CRESCENT_D} fill={color} stroke='none' />;
};

const Star = ({ color, isStill, star }: { color: string; isStill: boolean; star: (typeof STARS)[number] }) => {
	const animatedProps = useFadeIn({ delay: star.delay, duration: star.duration, isStill });

	return (
		<AnimatedCircle animatedProps={animatedProps} cx={star.cx} cy={star.cy} fill={color} r={star.r} stroke='none' />
	);
};

const Glow = ({ color, isStill }: { color: string; isStill: boolean }) => {
	const pulse = useSharedValue(0);

	useEffect(() => {
		if (isStill) {
			return;
		}

		pulse.value = withDelay(
			GLOW_DELAY_MS,
			withRepeat(withTiming(1, { duration: GLOW_HALF_CYCLE_MS, easing: Easing.inOut(Easing.quad) }), -1, true)
		);
	}, [isStill, pulse]);

	const animatedProps = useAnimatedProps(() => ({
		opacity: 0.35 + pulse.value * 0.35,
		r: GLOW_RADIUS * (1 + pulse.value * 0.08)
	}));

	return (
		<View pointerEvents='none' style={styles.glow}>
			<Svg height={GLOW_BOX * SCALE} viewBox={`0 0 ${GLOW_BOX} ${GLOW_BOX}`} width={GLOW_BOX * SCALE}>
				<Defs>
					<RadialGradient cx='50%' cy='50%' id='tourDoneGlow' r='50%'>
						<Stop offset='0' stopColor={color} stopOpacity={0.22} />
						<Stop offset='0.7' stopColor={color} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<AnimatedCircle
					animatedProps={animatedProps}
					cx={GLOW_BOX / 2}
					cy={GLOW_BOX / 2}
					fill='url(#tourDoneGlow)'
					r={GLOW_RADIUS}
				/>
			</Svg>
		</View>
	);
};

/**
 * O9's closing mark — a mosque drawn line by line, from `Tur Bitti Animasyonu.dc.html`.
 *
 * It replaced a tick in a soft disc. A tick is what a checkbox says; the tour has just walked
 * someone through fourteen stops of an app for reading the Cevşen together, and the frame's answer
 * is a drawing being completed under them. **The order is the point** — ground, walls, dome,
 * minarets, then the crescent and two stars — so this keeps the frame's own delays rather than
 * staggering by index.
 *
 * **The strokes are animated props, not styles.** `strokeDashoffset` is an SVG attribute, so it
 * goes through `useAnimatedProps` on an animated `Path` — the same shape `ProgressRing` already
 * uses for its arc. The CSS-transition rule `CellGrid` records is about a hundred views easing a
 * colour; this is nine shapes drawing once.
 *
 * Reduce Motion gets the finished drawing, rather than nothing or a tick.
 */
export const TourDoneMark = () => {
	const { theme } = useThemeContext();
	const isStill = useReducedMotion();

	return (
		<View style={styles.root}>
			<Glow color={theme.colors.accent} isStill={isStill} />
			<Svg
				// The frame's own `fill="none"`. Without it every path fills, and SVG's default
				// fill is black — a solid black dome and minarets under the sage outline.
				fill='none'
				height={VIEW_HEIGHT * SCALE}
				stroke={theme.colors.accent}
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={1.8}
				viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
				width={VIEW_WIDTH * SCALE}
			>
				{STROKES.map(stroke => (
					<DrawnStroke color={theme.colors.accent} isStill={isStill} key={stroke.d} stroke={stroke} />
				))}
				<Crescent color={theme.colors.accent} isStill={isStill} />
				{STARS.map(star => (
					<Star color={theme.colors.accent} isStill={isStill} key={star.cx} star={star} />
				))}
			</Svg>
		</View>
	);
};

const styles = StyleSheet.create({
	glow: {
		height: GLOW_BOX * SCALE,
		left: (VIEW_WIDTH / 2 - GLOW_BOX / 2) * SCALE,
		position: 'absolute',
		top: (GLOW_CENTRE_Y - GLOW_BOX / 2) * SCALE,
		width: GLOW_BOX * SCALE
	},
	root: {
		alignSelf: 'center',
		height: VIEW_HEIGHT * SCALE,
		// Small, because the drawing carries its own margin: the ground line sits 8 units up from
		// the foot of the box and the crescent leaves as much again at the top.
		marginBottom: 8,
		width: VIEW_WIDTH * SCALE
	}
});
