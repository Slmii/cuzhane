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

const Segment = ({ fitsContent = false, icon, isSelected, isWide = false, label, onPress }: SegmentProps) => {
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
		<Pressable
			accessibilityRole='tab'
			accessibilityState={{ selected: isSelected }}
			onPress={onPress}
			// Equal shares of the track, as the native control draws them on iOS — except a wide one,
			// which starts from its label's width.
			style={fitsContent ? styles.fitSlot : isWide ? styles.wideSlot : styles.slot}
		>
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
					{...(isWide || fitsContent ? { numberOfLines: 1 } : {})}
					style={styles.label}
					variant='bodyStrong'
				>
					{label}
				</Typography>
			</Animated.View>
		</Pressable>
	);
};

const DrawnSegmentedControl = ({ fitsContent = false, onChange, options, style, value }: SegmentedControlProps) => {
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
					{...(option.isWide ? { isWide: true } : {})}
					fitsContent={fitsContent}
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
		justifyContent: 'center',
		paddingHorizontal: 12,
		paddingVertical: 6
	},
	fitSlot: {
		flexShrink: 0
	},
	slot: {
		flexBasis: 0,
		flexGrow: 1
	},
	wideSlot: {
		flexGrow: 1,
		flexShrink: 0
	}
});

/**
 * **The platform's control where the platform has one worth having, ours everywhere else.**
 *
 * `isLiquidGlassSupported` is the gate, not `Platform.OS`. It is `false` on Android and on any
 * iOS below 26, so the question it answers is "does this device actually render Liquid Glass"
 * — the only reason to hand a control over. An iPhone on 18 keeps the drawn one rather than
 * getting a plain `UISegmentedControl` that matches neither the system nor the design system.
 *
 * The second half of the gate is about the *build* rather than the device: `@expo/ui` is a
 * native module, so a client compiled before it was added has nothing to reach.
 *
 * The same shape as `ui/Switch`. Both were drawn to match a mock; both now defer on the one
 * platform that repays it and keep the design's version on the rest. The contract is unchanged
 * either way, so no call site knows which it got — and the drawn one keeps
 * `SegmentedControlOption.icon`, which the native segments cannot take.
 */
/**
 * Whether the native control is what will render — **which a caller needs to know only to size
 * it.** The native one reports no intrinsic width and has to be given one; the drawn one hugs its
 * segments, and handing it the same fixed width padded it out with empty track after the last
 * option. Read it where the width is applied, as `AppButton` reads `isGlassButtonAvailable`.
 */
export const isSegmentedControlNative = isLiquidGlassSupported && isGlassSegmentedControlAvailable;

export const SegmentedControl = (props: SegmentedControlProps) =>
	isSegmentedControlNative ? <GlassSegmentedControl {...props} /> : <DrawnSegmentedControl {...props} />;
