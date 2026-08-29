import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

const SPIN_MS = 1500;

/**
 * The home skeleton's ring: a static track with one accent arc turning inside it.
 *
 * This is the design's answer to a loading screen that has to stay cheap. Shimmer overlays
 * and per-element pulses repaint continuously across everything on screen; a single rotating
 * arc is one animated node no matter how many bones surround it, so **the spinner carries
 * the motion and the bones stay still**. Don't add a pulse behind it — that reinstates the
 * cost this shape exists to avoid.
 *
 * The arc is a border with three transparent sides rather than an SVG stroke: it needs no
 * extra renderer, and at a 12pt border the rounded ends are not missed.
 */
export const SkeletonSpinner = ({ size = 204, thickness = 12 }: { size?: number; thickness?: number }) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const rotation = useSharedValue(0);

	useEffect(() => {
		if (isReducedMotion) {
			return;
		}

		rotation.value = withRepeat(
			withTiming(360, { duration: SPIN_MS, easing: Easing.bezier(0.5, 0.1, 0.5, 0.9) }),
			-1,
			false
		);
	}, [isReducedMotion, rotation]);

	const arcStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

	// Both rings are absolutely positioned inside an unbordered box, so they sit exactly
	// concentric rather than one nesting inside the other's border.
	const ring = { borderRadius: size / 2, borderWidth: thickness };

	return (
		<View style={{ height: size, width: size }}>
			<View style={[StyleSheet.absoluteFill, ring, { borderColor: theme.colors.secondary }]} />
			{/*
			 * Reduced motion gets the track alone. A frozen arc parked at twelve o'clock reads
			 * as a progress value rather than as "working".
			 */}
			{isReducedMotion ? null : (
				<Animated.View
					style={[
						StyleSheet.absoluteFill,
						ring,
						styles.arc,
						{ borderTopColor: theme.colors.accent },
						arcStyle
					]}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	arc: {
		borderColor: 'transparent'
	}
});
