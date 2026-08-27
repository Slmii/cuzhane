import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ProgressBarProps } from './ProgressBar.types';

const FILL_DURATION_MS = 900;

export const ProgressBar = ({ fillColor, height = 6, percent, style, trackColor }: ProgressBarProps) => {
	const { theme } = useThemeContext();
	const clampedPercent = Math.max(0, Math.min(100, percent));
	const radius = height / 2;
	const width = useSharedValue(clampedPercent);

	// Bars ease to their new value rather than snapping — progress arriving from a
	// refetch should read as movement, not a jump cut.
	useEffect(() => {
		width.value = withTiming(clampedPercent, {
			duration: FILL_DURATION_MS,
			easing: Easing.bezier(0.2, 0.9, 0.3, 1)
		});
	}, [clampedPercent, width]);

	const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

	return (
		<View
			accessibilityRole='progressbar'
			accessibilityValue={{ now: clampedPercent, min: 0, max: 100 }}
			style={[
				styles.track,
				{
					backgroundColor: trackColor ?? theme.colors.track,
					borderRadius: radius,
					height
				},
				style
			]}
		>
			<Animated.View
				style={[
					styles.fill,
					{
						backgroundColor: fillColor ?? theme.colors.accent,
						borderRadius: radius
					},
					fillStyle
				]}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	fill: {
		height: '100%'
	},
	track: {
		overflow: 'hidden',
		width: '100%'
	}
});
