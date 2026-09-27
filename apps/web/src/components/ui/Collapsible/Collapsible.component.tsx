import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { CollapsibleProps } from './Collapsible.types';

/** Long enough to read as a reveal, short enough that a switch still feels immediate. */
const DURATION_MS = 220;

/**
 * A block that opens and closes, animating **both** ways.
 *
 * **It stays mounted and clips itself, rather than entering and exiting.** The obvious
 * version — `{isOpen ? <Animated.View entering exiting /> : null}` — opens beautifully and
 * closes instantly: the exit has to outlive the unmount, and it loses the race against the
 * parent's own reflow, so the block vanishes and everything below it snaps up. Keeping the
 * view mounted and animating its height removes the race entirely; there is nothing to
 * outlive, and the content below follows the height down.
 *
 * The transition is declared as **Reanimated CSS properties on one flat style object**, the
 * same idiom `CellGrid` uses for its hundred cells and for the same reason: it runs on the
 * UI thread with no mapper per element. They must sit on a single flat object, not inside a
 * style array, or Reanimated never sees them.
 *
 * The child is measured at its natural height while the wrapper is clipped to zero, so the
 * height to animate *to* is always known — no first-open snap, and no guessed constant.
 */
export const Collapsible = ({ children, isOpen, style }: CollapsibleProps) => {
	const [height, setHeight] = useState(0);
	const isReducedMotion = useReducedMotion();
	// Before the first measurement `isOpen` has nothing to open to, so it stays closed for a
	// frame rather than jumping to a guess.
	const duration = isReducedMotion || height === 0 ? 0 : DURATION_MS;

	return (
		<Animated.View
			style={{
				height: isOpen ? height : 0,
				// Fading slightly ahead of the height keeps the content from looking squashed
				// on the way out.
				opacity: isOpen ? 1 : 0,
				overflow: 'hidden',
				transitionDuration: duration,
				transitionProperty: ['height', 'opacity'],
				transitionTimingFunction: 'ease-in-out'
			}}
		>
			{/*
			 * Absolutely positioned so its own height never depends on the wrapper's — a child
			 * in normal flow inside a zero-height clipped parent measures zero, and the block
			 * would then have no height to reopen to.
			 */}
			<View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={[styles.measure, style]}>
				{children}
			</View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	measure: {
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	}
});
