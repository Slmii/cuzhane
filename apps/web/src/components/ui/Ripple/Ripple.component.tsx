import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { RippleProps } from './Ripple.types';

/** The rings, this far apart (ms). */
const RIPPLE_DELAYS = [0, 800];

/**
 * **"Something is happening here"** — Birlikte oku's live mark: thin rings of one colour that
 * fade in as they grow out from behind a glyph or disc and fade away, again and again (after MUI's
 * avatar badge, 1.2 s, ease-in-out), without the thing itself moving. Sized by the caller so the
 * rings never outgrow the space they are drawn in — a bar or a strip would clip them.
 *
 * Fills its parent and centres the rings, so it goes first inside a box the size of what it
 * surrounds. A CSS keyframe on one flat style object per ring. Nothing with Reduce Motion.
 */
export const Ripple = ({ color, maxScale, size }: RippleProps) => {
	const isReducedMotion = useReducedMotion();

	if (isReducedMotion) {
		return null;
	}

	return (
		<View pointerEvents='none' style={styles.box}>
			{RIPPLE_DELAYS.map(delay => (
				<Animated.View
					key={delay}
					style={{
						animationDelay: delay,
						animationDuration: '1.2s',
						animationIterationCount: 'infinite',
						animationName: {
							// Faded in as it starts to grow, rather than appearing at full strength.
							'0%': { opacity: 0, transform: [{ scale: 0.8 }] },
							'15%': { opacity: 1, transform: [{ scale: 1 }] },
							// Still clear well out, so the rings read together; gone only at the edge.
							'70%': { opacity: 0.5, transform: [{ scale: 1 + (maxScale - 1) * 0.7 }] },
							'100%': { opacity: 0, transform: [{ scale: maxScale }] }
						},
						animationTimingFunction: 'ease-in-out',
						borderColor: color,
						borderRadius: size / 2,
						borderWidth: 1,
						height: size,
						// Unseen until its turn, so a delayed ring does not sit still first.
						opacity: 0,
						position: 'absolute',
						width: size
					}}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	box: {
		alignItems: 'center',
		bottom: 0,
		justifyContent: 'center',
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	}
});
