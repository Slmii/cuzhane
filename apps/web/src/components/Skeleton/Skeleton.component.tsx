import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated';
import type { BoneProps, SkeletonPulseProps } from './Skeleton.types';

const PULSE_MS = 780;
/**
 * Shallow on purpose — the same value `GridSkeleton` arrived at. The bones are only a few
 * percent darker than the card they sit on, so dipping toward half opacity takes them below
 * the point where the shape is legible and the card reads as blank.
 */
const PULSE_MIN_OPACITY = 0.72;

/**
 * One breathing pulse for a whole screen of bones.
 *
 * **One mapper per skeleton, never one per bone.** A `useAnimatedStyle` on every placeholder
 * is what made the bab board unscrollable (see CLAUDE.md), and a loading screen is the worst
 * place to spend that budget: it is on screen precisely while the app is busy. Wrapping the
 * subtree means the whole skeleton breathes on one animation regardless of how many bones it
 * holds.
 *
 * Motion is the *only* signal here — the design dropped shimmer overlays because they
 * repaint continuously — so a reader who has asked for reduced motion gets a flat, static
 * skeleton rather than a substitute effect.
 */
export const SkeletonPulse = ({ children, style }: SkeletonPulseProps) => {
	const isReducedMotion = useReducedMotion();
	const pulse = useSharedValue(1);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		// Breathing, not blinking: a flat grey block reads as content that failed to load.
		pulse.value = withRepeat(
			withSequence(withTiming(PULSE_MIN_OPACITY, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })),
			-1,
			false
		);
	}, [isReducedMotion, pulse]);

	const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

	return <Animated.View style={[style, pulseStyle]}>{children}</Animated.View>;
};

/**
 * A single placeholder shape.
 *
 * The two tones are the theme's own neutrals rather than the design's literal `#E6E3DC` /
 * `#EDEAE3`: those are the light palette's values, and a hardcoded pair would stay cream on
 * the dark background. `secondary` and `divider` are what those hexes already are in light
 * mode, and they carry their own dark counterparts.
 */
export const Bone = ({ height = 10, radius = 5, style, tone = 'strong', width }: BoneProps) => {
	const { theme } = useThemeContext();

	return (
		<View
			style={[
				styles.bone,
				{
					backgroundColor: tone === 'soft' ? theme.colors.divider : theme.colors.secondary,
					borderRadius: radius,
					height
				},
				width === undefined ? null : { width },
				style
			]}
		/>
	);
};

const styles = StyleSheet.create({
	bone: {
		// A bone must never be squeezed to nothing by a row that runs long.
		flexShrink: 0
	}
});
