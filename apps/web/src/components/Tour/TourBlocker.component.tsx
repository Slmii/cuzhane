import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTour } from './Tour.context';

/**
 * Makes the app underneath the tour untouchable while it is running ("Uygulama kilitli").
 *
 * **The scrim is not enough, and reasoning from what it covers is how that was missed.** The
 * overlay paints over the whole screen, tab bar and navigation bar included, so it looked as
 * though it must be receiving those taps too — and it is not. A group row under the scrim still
 * opened its group. Drawing order and hit-testing order agree only inside one view hierarchy,
 * and the navigator's screens, its native tab bar and its headers are hosted in their own view
 * controllers; a sibling view that draws above them does not necessarily sit above them for
 * touch.
 *
 * `pointerEvents='none'` on an ancestor does not care about any of that. UIKit's hit test skips
 * a view with interaction disabled **and its entire subtree**, so one flag here covers every
 * screen, the bar and the tab bar at once, native children included.
 *
 * The overlay keeps its own full-screen blocker as well. Belt and braces: this one is the
 * guarantee, that one is what stops a tap in the cut-out reaching the control it frames.
 *
 * **It engages exactly when the overlay is on screen, and not a moment before** — the two read
 * the same `isActive && !isBlocked`, so the app is never inert with nothing over it to explain
 * why. Every stop is drawn by the overlay now, T1 and the closing card included; the closing
 * card sits over the reader's own Ana sayfa, which stays inert until "Tamam".
 *
 * Hiding it from assistive technology goes with the flag. `pointerEvents` stops a finger and
 * nothing else — VoiceOver would still walk into the dimmed app and activate a control there.
 */
export const TourBlocker = ({ children }: { children: ReactNode }) => {
	const { isActive, isBlocked } = useTour();
	const isTourOverApp = isActive && !isBlocked;

	return (
		<View
			accessibilityElementsHidden={isTourOverApp}
			importantForAccessibility={isTourOverApp ? 'no-hide-descendants' : 'auto'}
			pointerEvents={isTourOverApp ? 'none' : 'auto'}
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
