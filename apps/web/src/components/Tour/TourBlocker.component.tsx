import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTour, WELCOME_STEP } from './Tour.context';

/**
 * Makes the app underneath the tour untouchable while it is running.
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
 * **It engages exactly when the overlay is on screen, and not a moment before.** The two used to
 * disagree: this read `isActive`, the overlay drew on `isActive && !isBlocked` and rendered only
 * an OS sheet at the welcome step. So there were two states where the app was inert with nothing
 * over it to explain why — and one of them was the documented "the sheet never presented" race,
 * which would have left no way out but killing the app. The welcome card needs nothing from this
 * anyway: it is a platform sheet, and a platform sheet already blocks what is behind it.
 *
 * Hiding it from assistive technology goes with the flag. `pointerEvents` stops a finger and
 * nothing else — VoiceOver would still walk into the dimmed app and activate a control there.
 */
export const TourBlocker = ({ children }: { children: ReactNode }) => {
	const { isActive, isBlocked, stepIndex } = useTour();
	const isTourOverApp = isActive && !isBlocked && stepIndex > WELCOME_STEP;

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
