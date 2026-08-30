import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { ProgressBarProps } from './ProgressBar.types';

const FILL_DURATION_MS = 900;

/**
 * A track and a fill that eases to its value — progress arriving from a refetch should read
 * as movement, not a jump cut.
 *
 * **The easing is a Reanimated CSS transition on one flat style object, and that matters
 * because bars come in crowds.** There is one per member row, one per historical round, one
 * per group card; a screen can hold dozens. Each used to carry a `useSharedValue`, a
 * `useEffect` and a `useAnimatedStyle`, so the mapper count grew with the list and every one
 * of them re-synchronised on a query refetch — the same per-item cost the bab board was
 * rebuilt to avoid. Declared as a transition there are no hooks at all: the value is just the
 * width, and the platform interpolates it.
 *
 * The transition properties must sit on this **one flat object**. Inside a style array
 * Reanimated never sees them and the bar snaps.
 */
export const ProgressBar = ({ fillColor, height = 6, percent, style, trackColor }: ProgressBarProps) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const clampedPercent = Math.max(0, Math.min(100, percent));
	const radius = height / 2;

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
				style={{
					...styles.fill,
					backgroundColor: fillColor ?? theme.colors.accent,
					borderRadius: radius,
					width: `${clampedPercent}%`,
					...(isReducedMotion ? null : { transitionDuration: FILL_DURATION_MS, transitionProperty: 'width' })
				}}
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
