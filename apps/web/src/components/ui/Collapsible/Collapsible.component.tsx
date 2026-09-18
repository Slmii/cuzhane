import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming
} from 'react-native-reanimated';
import type { CollapsibleProps } from './Collapsible.types';

/** Long enough to read as the block leaving, short enough not to hold up the tap. */
const COLLAPSE_MS = 240;

/**
 * Opens and closes a block, taking the surface around it with it.
 *
 * **Height and opacity move together, on a measured height.** A `LinearTransition` on the card
 * was the first attempt and is not the same thing: it springs the *card* to its new size while
 * the contents mount and unmount instantly, so the block pops in at full strength and vanishes
 * mid-collapse. Animating the block itself means the card follows, because the block is what
 * takes up the room.
 *
 * **The child is absolutely positioned so it keeps its natural height.** That is what makes this
 * work without being told a number: the child lays out at whatever size it wants, reports it
 * through `onLayout`, and the clipping box is what animates. Nothing here needs a magic constant,
 * and the block can change size later without this knowing.
 *
 * It stays **mounted while closed** — there is nothing to measure otherwise, and the first open
 * would animate from zero to zero. `pointerEvents` is what keeps a clipped control unreachable.
 */
export const Collapsible = ({ children, isOpen }: CollapsibleProps) => {
	const isReducedMotion = useReducedMotion();
	const contentHeight = useSharedValue(0);
	const progress = useSharedValue(isOpen ? 1 : 0);

	useEffect(() => {
		const target = isOpen ? 1 : 0;

		progress.value = isReducedMotion
			? target
			: withTiming(target, { duration: COLLAPSE_MS, easing: Easing.bezier(0.2, 0.9, 0.3, 1) });
	}, [isOpen, isReducedMotion, progress]);

	const animatedStyle = useAnimatedStyle(() => ({
		height: contentHeight.value * progress.value,
		opacity: progress.value
	}));

	return (
		<Animated.View pointerEvents={isOpen ? 'auto' : 'none'} style={[styles.clip, animatedStyle]}>
			<View
				onLayout={event => {
					contentHeight.value = event.nativeEvent.layout.height;
				}}
				style={styles.content}
			>
				{children}
			</View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	clip: {
		overflow: 'hidden'
	},
	content: {
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	}
});
