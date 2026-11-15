import { hatimCompletePalette as palette, toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import Svg, { Defs, G, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { HatimCelebrationProps } from './HatimCelebration.types';

/*
 * Q7's celebration, from "Hatim Tamamlandi.dc.html" (`q7Fx`): a burst around the ring as the
 * book closes — glow, a fan of rays, three gilt rings and twenty-two pieces thrown outward — and
 * a few stars twinkling across the page. (Its falling confetti was removed on request.)
 *
 * **Every number is the design's**: the timings, the easings, the counts, and the scatter, which
 * comes from its own deterministic `rnd` so each piece lands where the frame puts it. The
 * keyframes are plain objects built per element — never a shared `Keyframe`, whose `.delay()`
 * mutates it (see `CellGrid`).
 */

/** The design's `rnd`: a stable pseudo-random fraction for piece `i`, channel `m`. */
const rnd = (i: number, m: number) => (((Math.sin(i * 12.9898 + m * 78.233) * 43758.5453) % 1) + 1) % 1;

const CONFETTI = [palette.goldLight, palette.gold, palette.white, palette.sagePale, palette.goldDeep];
const confettiColor = (i: number) => CONFETTI[i % CONFETTI.length] ?? palette.gold;

/** The design's eight-pointed star, on a 20-unit grid centred on the origin. */
const STAR_PATH =
	'M0-10L2.9-7 7.1-7.1 7 -2.9 10 0 7 2.9 7.1 7.1 2.9 7 0 10-2.9 7-7.1 7.1-7 2.9-10 0-7-2.9-7.1-7.1-2.9-7Z';

export const Star8 = ({ color, size }: { color: string; size: number }) => (
	<Svg height={size} viewBox='-10 -10 20 20' width={size}>
		<Path d={STAR_PATH} fill={color} />
	</Svg>
);

/** A CSS animation as Reanimated reads it, resting on its first frame until it starts (`both`). */
const animation = (
	keyframes: Record<string, object>,
	durationMs: number,
	delayMs: number,
	timing: ReturnType<typeof cubicBezier> | 'linear' | 'ease-in-out',
	iterations = 1
) => ({
	...(keyframes['0%'] ?? {}),
	animationDelay: delayMs,
	animationDuration: durationMs,
	animationFillMode: 'both' as const,
	animationIterationCount: iterations,
	animationName: keyframes,
	animationTimingFunction: timing
});

const RING_SIZE = 176;
/**
 * `radial-gradient(circle, …)` sizes to the box's **farthest corner**, not its edge — for a
 * square, half its diagonal: 70.71% of the side. Written as SVG's `r='50%'` (the edge) the glow
 * and the rays ended inside the ring's opaque disc and never showed at all.
 */
const CSS_CIRCLE_RADIUS = `${(Math.SQRT2 / 2) * 100}%`;

// The fan of rays: sixteen 6° wedges, one every 22.5°, as `repeating-conic-gradient` draws them.
const RAYS_SIZE = RING_SIZE + 60;
const RAY_WEDGES = Array.from({ length: 16 }, (_, i) => {
	const radius = RAYS_SIZE;
	const toPoint = (degrees: number) => {
		// Conic gradients start at twelve o'clock and run clockwise.
		const radians = ((degrees - 90) * Math.PI) / 180;

		return `${(RAYS_SIZE / 2 + Math.cos(radians) * radius).toFixed(2)} ${(
			RAYS_SIZE / 2 +
			Math.sin(radians) * radius
		).toFixed(2)}`;
	};
	const start = i * 22.5;

	return `M${RAYS_SIZE / 2} ${RAYS_SIZE / 2}L${toPoint(start)}L${toPoint(start + 6)}Z`;
});

/**
 * The burst behind the ring — laid in the ring's own box, first, so the ring's disc covers its
 * middle and only what spills past the ring shows, as in the frame.
 */
export const HatimBurst = ({ isReducedMotion }: HatimCelebrationProps) => {
	const glowStyle = isReducedMotion
		? { opacity: 0.35 }
		: animation(
				{
					'0%': { opacity: 0.35, transform: [{ scale: 1 }] },
					'50%': { opacity: 0.7, transform: [{ scale: 1.12 }] },
					'100%': { opacity: 0.35, transform: [{ scale: 1 }] }
				},
				3200,
				4100,
				'ease-in-out',
				3
		  );
	const raysStyle = isReducedMotion
		? { opacity: 0.55 }
		: animation(
				{
					'0%': { opacity: 0, transform: [{ scale: 0.4 }, { rotate: '-20deg' }] },
					'40%': { opacity: 0.9 },
					'100%': { opacity: 0.55, transform: [{ scale: 1 }, { rotate: '0deg' }] }
				},
				1400,
				3600,
				cubicBezier(0.2, 0.8, 0.3, 1)
		  );

	return (
		<View pointerEvents='none' style={StyleSheet.absoluteFill}>
			<Animated.View style={[styles.glow, glowStyle]}>
				<Svg height='100%' width='100%'>
					<Defs>
						<RadialGradient cx='50%' cy='50%' id='glow' r={CSS_CIRCLE_RADIUS}>
							<Stop offset='0' stopColor={palette.goldLight} stopOpacity={0.4} />
							<Stop offset='0.65' stopColor={palette.goldLight} stopOpacity={0} />
						</RadialGradient>
					</Defs>
					<Rect fill='url(#glow)' height='100%' width='100%' />
				</Svg>
			</Animated.View>

			<Animated.View style={[styles.rays, raysStyle]}>
				<Svg height={RAYS_SIZE} width={RAYS_SIZE}>
					<Defs>
						{/* The frame's mask: solid to 35% of the radius, gone by 70%. */}
						<RadialGradient cx='50%' cy='50%' id='raysFade' r={CSS_CIRCLE_RADIUS}>
							<Stop offset='0.35' stopColor={palette.white} stopOpacity={1} />
							<Stop offset='0.7' stopColor={palette.white} stopOpacity={0} />
						</RadialGradient>
						<Mask height={RAYS_SIZE} id='raysMask' maskUnits='userSpaceOnUse' width={RAYS_SIZE} x={0} y={0}>
							<Rect fill='url(#raysFade)' height={RAYS_SIZE} width={RAYS_SIZE} />
						</Mask>
					</Defs>
					<G mask='url(#raysMask)'>
						{RAY_WEDGES.map(path => (
							<Path d={path} fill={toAlphaColor(palette.white, 0.12)} key={path} />
						))}
					</G>
				</Svg>
			</Animated.View>

			{isReducedMotion
				? null
				: [0, 1, 2].map(i => (
						<Animated.View
							key={`ring-${i}`}
							style={[
								styles.ring,
								{ borderColor: toAlphaColor(palette.goldLight, 0.8) },
								animation(
									{
										'0%': { opacity: 0.9, transform: [{ scale: 0.6 }] },
										'100%': { opacity: 0, transform: [{ scale: 2.6 }] }
									},
									2400,
									3900 + i * 350,
									cubicBezier(0.2, 0.7, 0.3, 1)
								)
							]}
						/>
				  ))}

			{isReducedMotion
				? null
				: Array.from({ length: 22 }, (_, i) => {
						const angle = (i / 22) * Math.PI * 2 + rnd(i, 1) * 0.3;
						const distance = 110 + rnd(i, 2) * 90;

						return (
							<Animated.View
								key={`piece-${i}`}
								style={[
									styles.piece,
									animation(
										{
											'0%': {
												opacity: 0,
												transform: [
													{ translateX: 0 },
													{ translateY: 0 },
													{ scale: 0.3 },
													{ rotate: '0deg' }
												]
											},
											'12%': { opacity: 1 },
											'100%': {
												opacity: 0,
												transform: [
													{ translateX: Math.cos(angle) * distance },
													{ translateY: Math.sin(angle) * distance },
													{ scale: 1 },
													{ rotate: `${rnd(i, 3) * 360 - 180}deg` }
												]
											}
										},
										1600,
										3850 + rnd(i, 4) * 200,
										cubicBezier(0.15, 0.8, 0.3, 1)
									)
								]}
							>
								{i % 3 === 0 ? (
									<Star8 color={confettiColor(i)} size={12} />
								) : (
									<View
										style={[
											styles.dot,
											{ backgroundColor: confettiColor(i), borderRadius: i % 2 ? 3 : 1 }
										]}
									/>
								)}
							</Animated.View>
						);
				  })}
		</View>
	);
};

/**
 * A few stars twinkling over the page. The design also rains confetti down it (`q7fall`); that
 * was removed on request — the burst around the ring is the celebration.
 */
export const HatimTwinkles = ({ isReducedMotion }: HatimCelebrationProps) => {
	if (isReducedMotion) {
		return null;
	}

	return (
		<View pointerEvents='none' style={styles.rain}>
			{Array.from({ length: 5 }, (_, i) => (
				<Animated.View
					key={`twinkle-${i}`}
					style={[
						styles.twinkle,
						{ left: `${8 + rnd(i, 10) * 84}%`, top: `${10 + rnd(i, 11) * 70}%` },
						animation(
							{
								'0%': { opacity: 0, transform: [{ scale: 0.3 }, { rotate: '0deg' }] },
								'50%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '45deg' }] },
								'100%': { opacity: 0, transform: [{ scale: 0.3 }, { rotate: '0deg' }] }
							},
							(2 + rnd(i, 12) * 1.5) * 1000,
							(1.5 + rnd(i, 13) * 3) * 1000,
							'ease-in-out',
							3
						)
					]}
				>
					<Star8 color={palette.twinkle} size={8} />
				</Animated.View>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	// Six by six with three of margin — the frame's twelve-point box, so stars and dots share a centre.
	dot: {
		height: 6,
		margin: 3,
		width: 6
	},
	glow: {
		borderRadius: (RING_SIZE + 48) / 2,
		bottom: -24,
		left: -24,
		overflow: 'hidden',
		position: 'absolute',
		right: -24,
		top: -24
	},
	piece: {
		left: RING_SIZE / 2 - 6,
		position: 'absolute',
		top: RING_SIZE / 2 - 6
	},
	rain: {
		bottom: 0,
		left: 0,
		overflow: 'hidden',
		position: 'absolute',
		right: 0,
		top: 0,
		zIndex: 0
	},
	rays: {
		height: RAYS_SIZE,
		left: -30,
		position: 'absolute',
		top: -30,
		width: RAYS_SIZE
	},
	ring: {
		borderRadius: RING_SIZE / 2,
		borderWidth: 1.5,
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	twinkle: {
		position: 'absolute'
	}
});
