import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	interpolate,
	runOnJS,
	useAnimatedProps,
	useAnimatedStyle,
	useDerivedValue,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { CountingText } from './CountingText.component';
import type { DockRingProps } from './DockRing.types';

/**
 * 01g — the docking ring.
 *
 * One ring bound to one group. Scrolling docks that *same* ring into the pinned pill:
 * nothing is duplicated or cross-faded, which is what makes it read as one object being
 * carried up rather than two elements swapping places. The design keeps every
 * interpolation in CSS `calc()` off two scalars; here they are `useAnimatedStyle`
 * readers off the same two shared values, so the whole dock runs on the UI thread.
 *
 * The design's two drifting aurora blobs are deliberately left out — a soft green wash
 * sliding behind the ring reads as a smudge on the screen rather than as light.
 *
 * Tapping a row in the list only *moves* the ring. The ring — at any size — and the
 * pill's button are the only things that commit.
 */

/** Sized to the 11.5pt commit label it leads. */
const COMMIT_ICON_SIZE = 13;

/** The core's own spacing, needed by the docked re-centring below. */
const MARK_ROW_GAP = 6;
const CORE_GAP = 5;

/** Rest → pinned, in points. Scroll is locked to this distance. */
const REST_Y = 116;
const PIN_Y = 15;
const DOCK_DISTANCE = REST_Y - PIN_Y;

const RING_SIZE = 236;
const SVG_SIZE = 204;
const CORE_SIZE = 168;
const HALO_SIZE = 168;
const RIPPLE_SIZE = 184;
const ARC_RADIUS = 112;
const ARC_VIEWBOX = 236;
const HEAD_DOT_SIZE = 10;
/**
 * The arc lives in a 236-unit viewBox drawn at 204pt, so on screen it sits at
 * `112 × 204/236 ≈ 96.8pt` — not at the head layer's own edge (102). Riding the dot on
 * the layer's edge, as `top: -5` does, leaves it 5pt outside the stroke it is supposed to
 * be the end of.
 */
const HEAD_DOT_TOP = SVG_SIZE / 2 - (ARC_RADIUS * SVG_SIZE) / ARC_VIEWBOX - HEAD_DOT_SIZE / 2;
const ORBIT_INNER = 214;

const SCREW_DEG = 186;
const PILL_ORIGIN_X = 22;
const RING_PIN_X = 11;
/** Where the labels sit once pinned: clear of the 46pt docked ring at x=11. */
const PIN_X = 68;
const NAME_LINE_HEIGHT = 21;
const RANGE_LINE_HEIGHT = 30;

/** Ambient loops, straight from the design's keyframes. */
const OUTER_SPIN_MS = 64_000;
const INNER_SPIN_MS = 96_000;
const OUTER_ORBIT_MS = 24_000;
const INNER_ORBIT_MS = 38_000;
const HALO_MS = 4_200;
const BREATHE_MS = 3_400;
const RIPPLE_MS = 700;
const RIPPLE_TRAIL_MS = 1_000;
const RIPPLE_TRAIL_DELAY_MS = 120;
const SPARK_MS = 780;
const BURST_MS = 1_200;

const SPARKS = Array.from({ length: 10 }, (_, index) => ({ angle: index * 36, delay: (index % 3) * 40 }));

const breathing = (duration: number) =>
	withRepeat(
		withSequence(
			withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.quad) }),
			withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.quad) })
		),
		-1,
		false
	);

const spinning = (duration: number) => withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);

/**
 * RN scales and rotates about a view's centre; the design scales the ring and its flying
 * labels from their top-left corner. Shifting by half the size each way turns one into
 * the other.
 */
const topLeftScaleShift = (size: number, scale: number) => {
	'worklet';

	return (size * (1 - scale)) / 2;
};

const Spark = ({ angle, color, delay }: { angle: number; color: string; delay: number }) => {
	const trackStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle}deg` }] }));
	const dotStyle = useAnimatedStyle(() => ({
		opacity: withDelay(
			delay,
			withSequence(withTiming(1, { duration: SPARK_MS * 0.25 }), withTiming(0, { duration: SPARK_MS * 0.75 }))
		),
		transform: [
			{
				translateY: withDelay(
					delay,
					withTiming(-142, { duration: SPARK_MS, easing: Easing.bezier(0.2, 0.8, 0.3, 1) })
				)
			},
			{ scale: withDelay(delay, withTiming(0.9, { duration: SPARK_MS })) }
		]
	}));

	return (
		<Animated.View pointerEvents='none' style={[styles.sparkTrack, trackStyle]}>
			<Animated.View style={[styles.spark, { backgroundColor: color, opacity: 0 }, dotStyle]} />
		</Animated.View>
	);
};

export const DockRing = ({
	group,
	horizontalInset,
	isCommitting = false,
	onCommit,
	scrollY,
	topInset,
	totalToday,
	width
}: DockRingProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const isReducedMotion = useReducedMotion();

	const [isBursting, setIsBursting] = useState(false);
	const [burstRun, setBurstRun] = useState(0);
	// Only the *docked* x needs a measured width — see the flyers below.
	const [nameWidth, setNameWidth] = useState(0);
	const [rangeWidth, setRangeWidth] = useState(0);
	// Measured so the docked number can be re-centred against the boxes the faded unit and
	// caption leave behind — see `markCentringStyle`.
	const [unitWidth, setUnitWidth] = useState(0);
	const [captionHeight, setCaptionHeight] = useState(0);

	const ripple = useSharedValue(0);
	const rippleTrail = useSharedValue(0);
	const breathe = useSharedValue(0);
	const halo = useSharedValue(0);
	const outerSpin = useSharedValue(0);
	const innerSpin = useSharedValue(0);
	const outerOrbit = useSharedValue(0);
	const innerOrbit = useSharedValue(0);
	const progress = useSharedValue(0);

	const isDone = group.total > 0 && group.done >= group.total;
	const remaining = Math.max(0, group.total - group.done);
	const percent = group.total > 0 ? group.done / group.total : 0;

	useEffect(() => {
		progress.value = withTiming(percent, { duration: 800, easing: Easing.bezier(0.22, 0.9, 0.28, 1) });
	}, [percent, progress]);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		breathe.value = breathing(BREATHE_MS);
		halo.value = breathing(HALO_MS);
		outerSpin.value = spinning(OUTER_SPIN_MS);
		innerSpin.value = spinning(INNER_SPIN_MS);
		outerOrbit.value = spinning(OUTER_ORBIT_MS);
		innerOrbit.value = spinning(INNER_ORBIT_MS);
	}, [breathe, halo, innerOrbit, innerSpin, isReducedMotion, outerOrbit, outerSpin]);

	/** Dock progress, linear 0..1 — scroll-locked to the collapse distance. */
	const dock = useDerivedValue(() => Math.min(1, Math.max(0, scrollY.value / DOCK_DISTANCE)));
	/** The same, eased. `easeInOutCubic`, as the design's `--e`. */
	const eased = useDerivedValue(() => {
		const value = dock.value;

		return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
	});

	const contentWidth = Math.max(1, width);

	const dockStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 0 }] }));

	const pillStyle = useAnimatedStyle(() => {
		const opacity = interpolate(dock.value, [0.4, 0.8], [0, 1], 'clamp');
		const scaleX = 0.12 + 0.88 * opacity;

		return {
			opacity,
			// `transform-origin: 22px 50%` — RN scales about the centre, so the box is
			// slid back by however far that origin sits from it.
			transform: [{ translateX: (PILL_ORIGIN_X - contentWidth / 2) * (1 - scaleX) }, { scaleX }]
		};
	});

	// The design's rest x of 57 is the ring centred in its 350pt column; on a wider screen
	// the constant would leave it visibly left of centre, so it is derived. The pinned x is
	// absolute and stays where the pill expects it.
	const ringRestX = (contentWidth - RING_SIZE) / 2;

	const ringStyle = useAnimatedStyle(() => {
		const scale = 1 - 0.805 * eased.value;
		const shift = topLeftScaleShift(RING_SIZE, scale);

		return {
			transform: [
				{ translateX: ringRestX - (ringRestX - RING_PIN_X) * dock.value - shift },
				{ translateY: REST_Y - DOCK_DISTANCE * dock.value - shift },
				{ scale }
			]
		};
	});

	const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-SCREW_DEG * eased.value}deg` }] }));
	const coreScrewStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${SCREW_DEG * eased.value}deg` }] }));

	const orbitsStyle = useAnimatedStyle(() => ({
		opacity: interpolate(dock.value, [0.25, 0.8], [1, 0], 'clamp'),
		transform: [{ scale: 1 - 0.48 * eased.value }]
	}));

	const outerSpinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${outerSpin.value * 360}deg` }] }));
	const innerSpinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${innerSpin.value * -360}deg` }] }));
	const outerOrbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${outerOrbit.value * 360}deg` }] }));
	const innerOrbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${innerOrbit.value * -360}deg` }] }));

	const trackProps = useAnimatedProps(() => ({ strokeWidth: 4 + 13 * dock.value }));
	const fillProps = useAnimatedProps(() => ({
		strokeWidth: 5 + 16 * dock.value,
		strokeDashoffset: 703.7 * (1 - progress.value)
	}));

	const headStyle = useAnimatedStyle(() => ({
		opacity: interpolate(dock.value, [0.35, 0.75], [1, 0], 'clamp'),
		transform: [{ rotate: `${progress.value * 360}deg` }]
	}));

	const haloStyle = useAnimatedStyle(() => ({
		opacity: 0.35 + halo.value * 0.4,
		transform: [{ scale: 1 + halo.value * 0.06 }]
	}));

	const coreShadowStyle = useAnimatedStyle(() => ({
		shadowOpacity: 0.14 + breathe.value * 0.12,
		shadowRadius: 14 + breathe.value * 3
	}));

	const markStyle = useAnimatedStyle(() => ({
		fontSize: 27 + 35 * dock.value,
		lineHeight: (27 + 35 * dock.value) * 1.1
	}));
	const coreLabelStyle = useAnimatedStyle(() => ({ opacity: interpolate(dock.value, [0, 0.28], [1, 0], 'clamp') }));

	/**
	 * The core centres a column of [number + unit] over [caption], and both of those fade
	 * without giving up their space. Docked, that leaves the number sitting half the unit's
	 * width to the left of centre and half the caption's height above it. Shifting by
	 * exactly that half — scaled by `eased`, so it is nothing at rest — lands the digit on
	 * the middle of the 33pt ring without disturbing the layout the design specifies.
	 */
	const hiddenUnitWidth = isDone ? 0 : unitWidth;
	const markCentringStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: ((MARK_ROW_GAP + hiddenUnitWidth) / 2) * eased.value },
			{ translateY: ((CORE_GAP + captionHeight) / 2) * eased.value }
		]
	}));

	const heroStyle = useAnimatedStyle(() => ({
		opacity: interpolate(dock.value, [0.15, 0.65], [1, 0], 'clamp')
	}));

	/**
	 * Centred at rest, pinned left at x=68.
	 *
	 * The design derives the rest x from the label's measured width. Doing that here made
	 * switching groups flicker: the new string paints before `onLayout` can report its
	 * width, so it landed at the old label's centre and then jumped. Hiding it until it was
	 * measured only turned the jump into a blink — and a name that happens to render the
	 * same width fires no layout event at all, so it would never come back.
	 *
	 * Instead the flyer spans the column and centres its own content, which is exact at
	 * rest for any string with nothing measured. The width is needed only for the docked
	 * position, which is not where reading happens.
	 */
	const flyX = (labelWidth: number, scale: number) => {
		'worklet';

		return PIN_X + (labelWidth * scale) / 2 - contentWidth / 2;
	};

	const nameStyle = useAnimatedStyle(() => {
		const scale = 1 - 0.3 * eased.value;

		return {
			transform: [
				{ translateX: flyX(nameWidth, scale) * eased.value },
				{ translateY: 30 - 8 * eased.value - topLeftScaleShift(NAME_LINE_HEIGHT, scale) },
				{ scale }
			]
		};
	});

	const rangeStyle = useAnimatedStyle(() => {
		const scale = 1 - 0.65 * eased.value;

		return {
			transform: [
				{ translateX: flyX(rangeWidth, scale) * eased.value },
				{ translateY: 80 - 39 * eased.value - topLeftScaleShift(RANGE_LINE_HEIGHT, scale) },
				{ scale }
			]
		};
	});

	const commitStyle = useAnimatedStyle(() => {
		const barText = interpolate(dock.value, [0.68, 1], [0, 1], 'clamp');

		return { opacity: barText, transform: [{ translateX: 18 - 18 * barText }] };
	});

	const rippleStyle = useAnimatedStyle(() => ({
		opacity: 0.9 * (1 - ripple.value),
		transform: [{ scale: 0.86 + ripple.value * 0.42 }]
	}));

	const rippleTrailStyle = useAnimatedStyle(() => ({
		opacity: 0.9 * (1 - rippleTrail.value),
		transform: [{ scale: 0.86 + rippleTrail.value * 0.42 }]
	}));

	const handleCommit = () => {
		setIsBursting(true);
		setBurstRun(run => run + 1);
		ripple.value = 0;
		ripple.value = withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) });
		rippleTrail.value = 0;
		rippleTrail.value = withDelay(
			RIPPLE_TRAIL_DELAY_MS,
			withTiming(1, { duration: RIPPLE_TRAIL_MS, easing: Easing.out(Easing.quad) }, finished => {
				if (finished) {
					runOnJS(setIsBursting)(false);
				}
			})
		);
		onCommit(group);
	};

	const coreBackground = isDone ? theme.colors.accent : theme.colors.surface;
	const coreForeground = isDone ? theme.colors.onAccent : theme.colors.text;

	return (
		<Animated.View
			pointerEvents='box-none'
			style={[styles.dock, { left: horizontalInset, right: horizontalInset, top: topInset }, dockStyle]}
		>
			{/* The pill is drawn outward from the ring rather than faded in. */}
			<Animated.View
				pointerEvents='none'
				style={[
					styles.pill,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.border,
						shadowColor: theme.colors.text
					},
					pillStyle
				]}
			/>

			<Animated.View style={[styles.ring, ringStyle]}>
				<Animated.View style={[styles.spin, spinStyle]}>
					{/* Orbits collapse inward to 52% before they fade. */}
					<Animated.View pointerEvents='none' style={[styles.orbits, orbitsStyle]}>
						<Animated.View style={[styles.orbitLayer, outerSpinStyle]}>
							<Svg height={RING_SIZE} width={RING_SIZE}>
								<Circle
									cx={RING_SIZE / 2}
									cy={RING_SIZE / 2}
									fill='none'
									r={RING_SIZE / 2 - 1}
									stroke={toAlphaColor(theme.colors.text, 0.12)}
									strokeDasharray='3 7'
									strokeWidth={1}
								/>
							</Svg>
						</Animated.View>
						<Animated.View style={[styles.orbitLayer, innerSpinStyle]}>
							<Svg height={ORBIT_INNER} width={ORBIT_INNER}>
								<Circle
									cx={ORBIT_INNER / 2}
									cy={ORBIT_INNER / 2}
									fill='none'
									r={ORBIT_INNER / 2 - 1}
									stroke={toAlphaColor(theme.colors.text, 0.12)}
									strokeWidth={1}
								/>
							</Svg>
						</Animated.View>
						<Animated.View
							style={[styles.orbitLayer, { height: RING_SIZE, width: RING_SIZE }, outerOrbitStyle]}
						>
							<View style={[styles.mote, { backgroundColor: toAlphaColor(theme.colors.accent, 0.45) }]} />
						</Animated.View>
						<Animated.View
							style={[styles.orbitLayer, { height: ORBIT_INNER, width: ORBIT_INNER }, innerOrbitStyle]}
						>
							<View
								style={[styles.moteSmall, { backgroundColor: toAlphaColor(theme.colors.accent, 0.45) }]}
							/>
						</Animated.View>
					</Animated.View>

					{/* Arc and track thicken as the ring shrinks, so the pinned ring stays legible. */}
					<Svg
						height={SVG_SIZE}
						style={styles.svg}
						viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
						width={SVG_SIZE}
					>
						<AnimatedCircle
							animatedProps={trackProps}
							cx={118}
							cy={118}
							fill='none'
							r={112}
							stroke={theme.colors.secondary}
						/>
						<AnimatedCircle
							animatedProps={fillProps}
							cx={118}
							cy={118}
							fill='none'
							r={112}
							stroke={theme.colors.accent}
							strokeDasharray={703.7}
							strokeLinecap='round'
							transform='rotate(-90 118 118)'
						/>
					</Svg>

					<Animated.View pointerEvents='none' style={[styles.head, headStyle]}>
						<View style={[styles.headDot, { backgroundColor: theme.colors.accent }]}>
							<View style={[styles.headHalo, { borderColor: toAlphaColor(theme.colors.accent, 0.16) }]} />
						</View>
					</Animated.View>

					<Animated.View pointerEvents='none' style={[styles.halo, haloStyle]}>
						<Svg height={HALO_SIZE} width={HALO_SIZE}>
							<Defs>
								<RadialGradient cx='50%' cy='50%' id='dockHalo' r='50%'>
									<Stop offset='0.7' stopColor={theme.colors.accent} stopOpacity={0.22} />
									<Stop offset='0.84' stopColor={theme.colors.accent} stopOpacity={0.14} />
									<Stop offset='1' stopColor={theme.colors.accent} stopOpacity={0} />
								</RadialGradient>
							</Defs>
							<Circle cx={HALO_SIZE / 2} cy={HALO_SIZE / 2} fill='url(#dockHalo)' r={HALO_SIZE / 2} />
						</Svg>
					</Animated.View>

					{isBursting ? (
						<>
							<Animated.View
								pointerEvents='none'
								style={[styles.ripple, { borderColor: theme.colors.accent }, rippleStyle]}
							/>
							<Animated.View
								pointerEvents='none'
								style={[
									styles.rippleTrail,
									{ borderColor: toAlphaColor(theme.colors.accent, 0.45) },
									rippleTrailStyle
								]}
							/>
							{SPARKS.map(spark => (
								<Spark
									angle={spark.angle}
									color={theme.colors.accent}
									delay={spark.delay}
									key={`${burstRun}-${spark.angle}`}
								/>
							))}
						</>
					) : null}

					{/* The core counter-rotates, so the count stays upright through the screw. */}
					<Animated.View style={[styles.coreWrap, coreScrewStyle]}>
						<Pressable
							accessibilityLabel={`${group.name} — ${isDone ? t('shareDone') : t('finishGroup')}`}
							accessibilityRole='button'
							accessibilityState={{ checked: isDone, disabled: isCommitting }}
							disabled={isCommitting}
							onPress={handleCommit}
						>
							<Animated.View
								style={[
									styles.core,
									{
										backgroundColor: coreBackground,
										borderColor: isDone ? theme.colors.accent : theme.colors.border,
										shadowColor: theme.colors.accent
									},
									coreShadowStyle
								]}
							>
								{/*
								 * Shifted to put the *number* on the core's centre once docked. The
								 * unit and the caption only fade — they keep their boxes — so the
								 * core goes on centring a row that is wider and taller than what is
								 * still visible, leaving the digit up and to the left in the 33pt
								 * ring. This cancels exactly their half, and is zero at rest.
								 */}
								<Animated.View style={[styles.markRow, markCentringStyle]}>
									<Animated.Text
										numberOfLines={1}
										style={[styles.mark, { color: coreForeground }, markStyle]}
									>
										{isDone ? '✓' : String(remaining)}
									</Animated.Text>
									{/*
									 * The unit rides the count at rest and leaves with the label on
									 * the way in: docked, the core is 33pt across and "16 bab" does
									 * not fit in it — the number alone does.
									 */}
									{isDone ? null : (
										<Animated.View
											onLayout={(event: LayoutChangeEvent) =>
												setUnitWidth(event.nativeEvent.layout.width)
											}
											style={coreLabelStyle}
										>
											<Typography color={coreForeground} style={styles.markUnit}>
												{t('babs')}
											</Typography>
										</Animated.View>
									)}
								</Animated.View>
								<Animated.View
									onLayout={(event: LayoutChangeEvent) =>
										setCaptionHeight(event.nativeEvent.layout.height)
									}
									style={coreLabelStyle}
								>
									<Typography color={coreForeground} style={styles.coreLabel} variant='bodyStrong'>
										{isDone ? t('shareDone') : t('finishGroup')}
									</Typography>
								</Animated.View>
							</Animated.View>
						</Pressable>
					</Animated.View>
				</Animated.View>
			</Animated.View>

			{/* Name and range are the same nodes at both ends — they fly, never cross-fade. */}
			<Animated.View pointerEvents='none' style={[styles.flyer, nameStyle]}>
				<View onLayout={(event: LayoutChangeEvent) => setNameWidth(event.nativeEvent.layout.width)}>
					<Typography color={theme.colors.text} style={styles.name} variant='title'>
						{group.name}
					</Typography>
				</View>
			</Animated.View>
			<Animated.View pointerEvents='none' style={[styles.flyer, rangeStyle]}>
				<View onLayout={(event: LayoutChangeEvent) => setRangeWidth(event.nativeEvent.layout.width)}>
					{/* The two numbers count to the new group's range rather than cutting. */}
					<CountingText
						color={theme.colors.accent}
						style={styles.range}
						value={group.range}
						variant='display'
					/>
				</View>
			</Animated.View>

			<Animated.View style={[styles.commit, commitStyle]}>
				<Pressable
					accessibilityLabel={isDone ? t('commitShareDone') : t('commitShare')}
					accessibilityRole='button'
					disabled={isCommitting}
					onPress={handleCommit}
					style={[
						styles.commitButton,
						// `--btn-bg` is the ink colour, which inverts with the theme — `primary`
						// is the sage in dark mode and would read as the done state.
						{ backgroundColor: isDone ? theme.colors.accent : theme.colors.text }
					]}
				>
					{/* The done label leads with a tick. It comes from the icon set, not a ✓
					    typed into the string — the ring's own core mark is the one glyph
					    exception around here, and this is an ordinary button beside it. */}
					{isDone ? (
						<Icon color={theme.colors.onAccent} name='check' size={COMMIT_ICON_SIZE} strokeWidth={2} />
					) : null}
					<Typography
						color={isDone ? theme.colors.onAccent : theme.colors.onPrimary}
						style={styles.commitLabel}
					>
						{isDone ? t('commitShareDone') : t('commitShare')}
					</Typography>
				</Pressable>
			</Animated.View>

			{/* Rest-state captions: they belong to the dock so they fade with it. */}
			<Animated.View pointerEvents='none' style={[styles.hero, heroStyle]}>
				<Typography color={theme.colors.subtext} style={styles.eyebrow} textAlign='center'>
					{t('ringEyebrow')}
				</Typography>
				<View
					style={[
						styles.totalChip,
						{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
					]}
				>
					<Typography color={theme.colors.subtext} style={styles.totalChipLabel} variant='mono'>
						{totalToday}
					</Typography>
				</View>
			</Animated.View>
			<Animated.View pointerEvents='none' style={[styles.caption, heroStyle]}>
				<Typography color={theme.colors.subtext} style={styles.captionLabel} textAlign='center'>
					{t('ringCaption')}
				</Typography>
			</Animated.View>
		</Animated.View>
	);
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
	caption: {
		left: 0,
		position: 'absolute',
		right: 0,
		// hero block (25) + dr-gap-name (34) — the band the design puts it in.
		top: 59
	},
	captionLabel: {
		fontSize: 12,
		lineHeight: 16
	},
	commit: {
		position: 'absolute',
		right: 11,
		top: 19
	},
	commitButton: {
		alignItems: 'center',
		borderRadius: 11,
		flexDirection: 'row',
		gap: 5,
		paddingHorizontal: 14,
		paddingVertical: 10
	},
	commitLabel: {
		fontSize: 11.5,
		fontWeight: '600',
		lineHeight: 14
	},
	core: {
		alignItems: 'center',
		borderRadius: CORE_SIZE / 2,
		borderWidth: 1.5,
		elevation: 6,
		gap: CORE_GAP,
		height: CORE_SIZE,
		justifyContent: 'center',
		shadowOffset: { width: 0, height: Platform.OS === 'ios' ? 10 : 6 },
		width: CORE_SIZE
	},
	coreLabel: {
		fontSize: 13.5,
		lineHeight: 18
	},
	coreWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		position: 'absolute'
	},
	dock: {
		height: 0,
		position: 'absolute',
		zIndex: 6
	},
	eyebrow: {
		fontSize: 11,
		letterSpacing: 1.1,
		lineHeight: 15,
		textTransform: 'uppercase'
	},
	// Spans the column so its content is centred by layout, not by a measured offset.
	flyer: {
		alignItems: 'center',
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	halo: {
		height: HALO_SIZE,
		position: 'absolute',
		width: HALO_SIZE
	},
	head: {
		height: SVG_SIZE,
		position: 'absolute',
		width: SVG_SIZE
	},
	headDot: {
		borderRadius: HEAD_DOT_SIZE / 2,
		height: HEAD_DOT_SIZE,
		left: '50%',
		marginLeft: -HEAD_DOT_SIZE / 2,
		position: 'absolute',
		top: HEAD_DOT_TOP,
		width: HEAD_DOT_SIZE
	},
	headHalo: {
		borderRadius: 10,
		borderWidth: 5,
		height: 20,
		left: -5,
		position: 'absolute',
		top: -5,
		width: 20
	},
	hero: {
		left: 0,
		paddingTop: 10,
		position: 'absolute',
		right: 0,
		top: 0
	},
	mark: {
		fontFamily: undefined,
		textAlign: 'center'
	},
	markRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: MARK_ROW_GAP
	},
	markUnit: {
		fontSize: 13.5,
		lineHeight: 18
	},
	mote: {
		borderRadius: 2,
		height: 4,
		left: '50%',
		marginLeft: -2,
		position: 'absolute',
		top: -2,
		width: 4
	},
	moteSmall: {
		borderRadius: 1.5,
		height: 3,
		left: '50%',
		marginLeft: -1.5,
		position: 'absolute',
		top: -1.5,
		width: 3
	},
	name: {
		fontSize: 17,
		lineHeight: 21
	},
	orbitLayer: {
		alignItems: 'center',
		justifyContent: 'center',
		position: 'absolute'
	},
	orbits: {
		alignItems: 'center',
		height: RING_SIZE,
		justifyContent: 'center',
		position: 'absolute',
		width: RING_SIZE
	},
	pill: {
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
		elevation: 8,
		height: 64,
		left: 0,
		position: 'absolute',
		right: 0,
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.12,
		shadowRadius: 28,
		top: 6
	},
	range: {
		fontSize: 30,
		lineHeight: 30
	},
	ring: {
		height: RING_SIZE,
		left: 0,
		position: 'absolute',
		top: 0,
		width: RING_SIZE
	},
	ripple: {
		borderRadius: RIPPLE_SIZE / 2,
		borderWidth: 2,
		height: RIPPLE_SIZE,
		position: 'absolute',
		width: RIPPLE_SIZE
	},
	rippleTrail: {
		borderRadius: RIPPLE_SIZE / 2,
		borderWidth: 1.5,
		height: RIPPLE_SIZE,
		position: 'absolute',
		width: RIPPLE_SIZE
	},
	spark: {
		borderRadius: 2,
		height: 4,
		marginLeft: -2,
		position: 'absolute',
		top: -84,
		width: 4
	},
	sparkTrack: {
		height: 0,
		position: 'absolute',
		width: 0
	},
	spin: {
		alignItems: 'center',
		bottom: 0,
		justifyContent: 'center',
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	svg: {
		position: 'absolute'
	},
	totalChip: {
		borderRadius: 9,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 9,
		paddingVertical: 7,
		position: 'absolute',
		right: 0,
		top: 4
	},
	totalChipLabel: {
		fontSize: 10.5,
		lineHeight: 13
	}
});

export { BURST_MS, DOCK_DISTANCE };
