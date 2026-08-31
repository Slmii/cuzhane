import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { GlassSegmentedControl, isGlassSegmentedControlAvailable } from './GlassSegmentedControl';
import type { SegmentedControlProps, SegmentProps } from './SegmentedControl.types';

/** Matches the design's `transition: background .25s ease`. */
const SELECTION_DURATION_MS = 250;

const Segment = ({ icon, isSelected, label, onPress }: SegmentProps) => {
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
				{/* Sized to the 11.5pt label beside it rather than the icon's own default. */}
				{icon ? (
					<Icon
						color={isSelected ? theme.colors.text : theme.colors.subtext}
						name={icon}
						size={14}
						strokeWidth={1.7}
					/>
				) : null}
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

const DrawnSegmentedControl = ({ onChange, options, style, value }: SegmentedControlProps) => {
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
					{...(option.icon ? { icon: option.icon } : {})}
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
		flexDirection: 'row',
		gap: 5,
		paddingHorizontal: 12,
		paddingVertical: 6
	}
});

/**
 * **The platform's control where the platform has one worth having, ours everywhere else.**
 *
 * `isLiquidGlassSupported` is the gate, not `Platform.OS`. It is `false` on Android and on any
 * iOS below 26 — so the question it answers is "does this device actually render Liquid Glass",
 * which is the only reason to hand the control over. An iPhone on iOS 18 keeps the drawn one
 * rather than getting a plain `UISegmentedControl` that matches neither the system nor us.
 *
 * The same shape as `ui/Switch`. Both were drawn to match a mock; both now defer on the one
 * platform that repays it and keep the design system's version on the rest.
 *
 * The second half of the gate is about the *build* rather than the device: `@expo/ui` is a
 * native module, so a dev client compiled before it was added has no SwiftUI bridge to reach.
 * Without that check every screen holding a segmented control redboxes until someone rebuilds.
 *
 * The contract is unchanged either way, so no call site knows which it got — and the drawn one
 * keeps `SegmentedControlOption.icon`, which SwiftUI's segments cannot take.
 */
export const SegmentedControl = (props: SegmentedControlProps) =>
	isLiquidGlassSupported && isGlassSegmentedControlAvailable ? (
		<GlassSegmentedControl {...props} />
	) : (
		<DrawnSegmentedControl {...props} />
	);
