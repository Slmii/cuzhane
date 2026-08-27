import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { ProgressRingProps } from './ProgressRing.types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular track + progress arc, drawn as an SVG stroke and animated by easing the
 * dash offset. Rotated -90° so the arc starts at twelve o'clock like the design.
 */
export const ProgressRing = ({
	children,
	percent,
	size = 236,
	strokeWidth = 4,
	trackWidth,
	style
}: ProgressRingProps) => {
	const { theme } = useThemeContext();
	// Both circles share a radius so the arc rides the centre of the track — the track is
	// the thinner of the two, and the arc is meant to sit slightly proud of it.
	const radius = (size - Math.max(strokeWidth, trackWidth ?? strokeWidth)) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withTiming(Math.max(0, Math.min(100, percent)) / 100, {
			duration: 750,
			easing: Easing.bezier(0.22, 0.9, 0.28, 1)
		});
	}, [percent, progress]);

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
					stroke={theme.colors.secondary}
					strokeWidth={trackWidth ?? strokeWidth}
				/>
				<AnimatedCircle
					animatedProps={animatedProps}
					cx={size / 2}
					cy={size / 2}
					fill='none'
					r={radius}
					stroke={theme.colors.accent}
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
