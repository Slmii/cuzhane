import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

type Props = {
	color: string;
	/** A ring rather than a filled dot: following has stopped. */
	isRing?: boolean;
	/** The ripple the design draws around a live dot. */
	isPulsing?: boolean;
};

/**
 * The live row's state mark: a filled dot, pulsing while the session is live or waiting; a ring
 * once a follower has let go. The ripple is a CSS keyframe on one flat style object (a style
 * array hides it from Reanimated), built per dot, and off with Reduce Motion.
 */
export const LiveDot = ({ color, isPulsing = false, isRing = false }: Props) => {
	const isReducedMotion = useReducedMotion();

	return (
		<View style={styles.box}>
			{isPulsing && !isReducedMotion ? (
				<Animated.View
					style={{
						...styles.fill,
						animationDuration: '1.8s',
						animationIterationCount: 'infinite',
						animationName: {
							from: { opacity: 0.5, transform: [{ scale: 0.6 }] },
							to: { opacity: 0, transform: [{ scale: 2 }] }
						},
						animationTimingFunction: 'ease-out',
						backgroundColor: color
					}}
				/>
			) : null}
			<View style={[styles.fill, isRing ? { borderColor: color, borderWidth: 2 } : { backgroundColor: color }]} />
		</View>
	);
};

const styles = StyleSheet.create({
	box: {
		height: 10,
		width: 10
	},
	fill: {
		borderRadius: 5,
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	}
});
