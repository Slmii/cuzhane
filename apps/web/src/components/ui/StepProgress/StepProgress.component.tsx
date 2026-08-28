import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import type { StepProgressProps } from './StepProgress.types';

/** Long enough to read as the rail filling, short enough not to lag the screen change. */
const FILL_MS = 280;

type BarProps = {
	color: string;
	duration: number;
};

/**
 * One dash. Split out so each can own its animated style — hooks can't run in a loop in
 * the parent, the same reason `CellGrid` has a `Cell`.
 */
const Bar = ({ color, duration }: BarProps) => {
	const animatedStyle = useAnimatedStyle(() => ({ backgroundColor: withTiming(color, { duration }) }));

	return <Animated.View style={[styles.bar, animatedStyle]} />;
};

/**
 * The wizard's step rail.
 *
 * The dashes ease between states rather than snapping. Stepping between screens already
 * moves the whole page, and a rail that cut instantly read as a separate, unrelated jump —
 * the transition is what ties it to the navigation. It runs in both directions for free,
 * so going back drains the dash it filled.
 */
export const StepProgress = ({ current, style, total }: StepProgressProps) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();

	return (
		<View
			accessibilityRole='progressbar'
			accessibilityValue={{ now: current, min: 1, max: total }}
			style={[styles.row, style]}
		>
			{Array.from({ length: total }, (_, index) => (
				<Bar
					color={index < current ? theme.colors.accent : theme.colors.switchTrackOff}
					duration={isReducedMotion ? 0 : FILL_MS}
					key={index}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	bar: {
		borderRadius: 2,
		flex: 1,
		height: 3
	},
	row: {
		flexDirection: 'row',
		gap: 5
	}
});
