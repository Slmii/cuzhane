import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useHintsContext } from './Hints.context';

/**
 * Makes the app underneath a hint untouchable while its card is up: the card's own button is the
 * only way on, and a tap beside it does nothing.
 *
 * **The overlay's scrim is not enough.** It paints over the whole screen, tab bar and navigation
 * bar included, yet a group row under it still opened its group: the navigator's screens, its
 * native tab bar and its headers are hosted in their own view controllers, and a sibling view that
 * draws above them does not necessarily sit above them for touch.
 *
 * `pointerEvents='none'` on an ancestor does not care about any of that. UIKit's hit test skips
 * a view with interaction disabled **and its entire subtree**, so one flag here covers every
 * screen, the bar and the tab bar at once, native children included. The overlay keeps its own
 * full-screen blocker as well, for a tap inside the cut-out.
 *
 * It engages exactly when a card is on screen (`isShowing`), so the app is never inert with
 * nothing over it to say why. Hiding it from assistive technology goes with the flag —
 * `pointerEvents` stops a finger and nothing else.
 */
export const HintBlocker = ({ children }: { children: ReactNode }) => {
	const { isShowing } = useHintsContext();

	return (
		<View
			accessibilityElementsHidden={isShowing}
			importantForAccessibility={isShowing ? 'no-hide-descendants' : 'auto'}
			pointerEvents={isShowing ? 'none' : 'auto'}
			style={styles.fill}
		>
			{children}
		</View>
	);
};

const styles = StyleSheet.create({
	fill: {
		flex: 1
	}
});
