import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedProps,
	useReducedMotion,
	useSharedValue,
	withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { ProgressRingProps } from './ProgressRing.types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ticking ring's step — one second, the countdown's own unit. */
const TICK_MS = 1000;

/**
 * Circular track + progress arc, drawn as an SVG stroke and animated by easing the
 * dash offset. Rotated -90° so the arc starts at twelve o'clock like the design.
 */
export const ProgressRing = ({
	children,
	color,
	isTicking = false,
	percent,
	size = 236,
	strokeWidth = 4,
	trackColor,
	trackWidth,
	style
}: ProgressRingProps) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	// Both circles share a radius so the arc rides the centre of the track — the track is
	// the thinner of the two, and the arc is meant to sit slightly proud of it.
	const radius = (size - Math.max(strokeWidth, trackWidth ?? strokeWidth)) / 2;
	const circumference = 2 * Math.PI * radius;
	const fraction = Math.max(0, Math.min(100, percent)) / 100;
	const progress = useSharedValue(isTicking ? fraction : 0);

	useEffect(() => {
		if (isTicking) {
			progress.value = isReducedMotion
				? fraction
				: withTiming(fraction, { duration: TICK_MS, easing: Easing.linear });
			return;
		}

		progress.value = withTiming(fraction, {
			duration: 750,
			easing: Easing.bezier(0.22, 0.9, 0.28, 1)
		});
	}, [fraction, isReducedMotion, isTicking, progress]);

	const animatedProps = useAnimatedProps(() => ({
		strokeDashoffset: circumference * (1 - progress.value)
	}));

	return (
		<View style={[styles.container, { height: size, width: size }, style]}>
			<Svg height={size} style={[styles.svg, { transform: [{ rotate: '-90deg' }] }]} width={size}>
				<Circle
					cx={size / 2}
					cy={size / 2}
					fill='none'
					r={radius}
					stroke={trackColor ?? theme.colors.secondary}
					strokeWidth={trackWidth ?? strokeWidth}
				/>
				<AnimatedCircle
					animatedProps={animatedProps}
					cx={size / 2}
					cy={size / 2}
					fill='none'
					r={radius}
					stroke={color ?? theme.colors.accent}
					strokeDasharray={circumference}
					strokeLinecap='round'
					strokeWidth={strokeWidth}
				/>
			</Svg>
			{children}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	svg: {
		position: 'absolute'
	}
});
