import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { SegmentedControlProps, SegmentProps } from './SegmentedControl.types';

/** Matches the design's `transition: background .25s ease`. */
const SELECTION_DURATION_MS = 250;

const Segment = ({ isSelected, label, onPress }: SegmentProps) => {
	const { theme } = useThemeContext();

	// Fades the pill's alpha rather than swapping to `transparent`, so the colour
	// interpolates cleanly instead of jumping through an unrelated hue. Both endpoints
	// are resolved here — a worklet can only use plain values, not `toAlphaColor`.
	const activeColor = theme.colors.segmentActive;
	const restingColor = toAlphaColor(activeColor, 0);
	const targetColor = isSelected ? activeColor : restingColor;

	const animatedStyle = useAnimatedStyle(
		() => ({ backgroundColor: withTiming(targetColor, { duration: SELECTION_DURATION_MS }) }),
		[targetColor]
	);

	return (
		<Pressable accessibilityRole='tab' accessibilityState={{ selected: isSelected }} onPress={onPress}>
			<Animated.View style={[styles.segment, { borderRadius: theme.radius.sm }, animatedStyle]}>
				<Typography
					color={isSelected ? theme.colors.text : theme.colors.subtext}
					style={styles.label}
					variant='bodyStrong'
				>
					{label}
				</Typography>
			</Animated.View>
		</Pressable>
	);
};

export const SegmentedControl = ({ onChange, options, style, value }: SegmentedControlProps) => {
	const { theme } = useThemeContext();

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: theme.colors.segmentTrack,
					borderRadius: theme.radius.sm + 2
				},
				style
			]}
		>
			{options.map(option => (
				<Segment
					isSelected={option.value === value}
					key={option.value}
					label={option.label}
					onPress={() => onChange(option.value)}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		padding: 3
	},
	label: {
		fontSize: 11.5
	},
	segment: {
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 6
	}
});
