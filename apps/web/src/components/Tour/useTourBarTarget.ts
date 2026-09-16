import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTour } from './Tour.context';
import type { TourTargetId } from './tourSteps';

/** One toolbar item, the 44pt disc every bar glyph is drawn in — the same on both platforms. */
const BAR_ITEM_SIZE = 44;
/**
 * Where the row of items sits, which the two platforms do **not** agree on: iOS groups them in
 * its own capsule and Android lays them out in a Material top bar.
 *
 * Every number was read off a screenshot rather than guessed — the glyph centres on the group
 * screen's toolbar, against the window width and the top inset the bar reported:
 *
 * | | right edge to the last item | top inset to the item's top |
 * | --- | --- | --- |
 * | iOS | 20.5 | 0 |
 * | Android | 16 | 6 |
 *
 * **iOS's trailing inset is not the same on every phone**, and this is the one number here that
 * cannot be derived. Measured at 20.5 on a 15 Pro (393pt, iOS 26.5) and 24.5 on a 17 Pro Max
 * (440pt, iOS 26.4) — the bar's own capsule sizes itself, and neither the safe area nor the
 * window width predicts it. The smaller phone wins because it is the one this was reported on;
 * a wider one puts the hole about four points left of its glyph, inside a sixty-point circle.
 *
 * If it ever needs to be exact everywhere, the fix is not a better constant: it is for the bar
 * to report its own frame, which `measureInWindow` cannot do from inside a header — see below.
 */
const BAR_TRAILING_INSET = Platform.OS === 'android' ? 16 : 20.5;
const BAR_TOP_GAP = Platform.OS === 'android' ? 6 : 0;

/**
 * How far the cut-out stands off the item, mirroring the overlay's own padding — declared here
 * because the radius below is worked out from the padded box.
 */
const SPOTLIGHT_PADDING = 8;

/**
 * **A circle on iOS, the overlay's usual rounded square on Android.**
 *
 * A bar glyph on iOS is a disc — the same control UIKit draws for the back chevron — so a
 * rounded square around it reads as a second, squarer control sitting behind the first. Android
 * draws a Material top bar and its own squarer touch target, which the default already suits.
 */
const BAR_SPOTLIGHT_RADIUS = Platform.OS === 'android' ? undefined : (BAR_ITEM_SIZE + SPOTLIGHT_PADDING * 2) / 2;

/**
 * Registers a tour rectangle for an item in the **navigator's bar**, computed rather than
 * measured.
 *
 * **A header is not in the screen's surface, and `measureInWindow` there does not answer in
 * window coordinates.** React Navigation hosts `headerRight` in a container of its own, so a
 * `TourTarget` around the reader's Aa control reported `y: 0` and an `x` counted from that
 * container's left edge — putting the spotlight on the back chevron, at the opposite corner of
 * the screen from the thing it was pointing at. Correcting `y` by the top inset fixed half of it
 * and left the hole on the chevron, which is how the second half was found.
 *
 * So this is arithmetic, like the bottom bar's rect was before it: the items are fixed-size
 * discs laid flush against the right edge, and a caller names which one it is counting back from
 * that edge — `0` is the account, `1` is the glyph beside it. Measured off a screenshot at 3x,
 * against a 440pt window: the last disc ends 24pt from the edge and the pair sits at `y: 62`
 * with a 59pt top inset.
 *
 */
export const useTourBarTarget = (id: TourTargetId, indexFromRight: number) => {
	const { registerTarget } = useTour();
	const isFocused = useIsFocused();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();

	useEffect(() => {
		if (!isFocused) {
			registerTarget(id, null);
			return;
		}

		registerTarget(id, {
			height: BAR_ITEM_SIZE,
			width: BAR_ITEM_SIZE,
			x: width - BAR_TRAILING_INSET - BAR_ITEM_SIZE * (indexFromRight + 1),
			y: insets.top + BAR_TOP_GAP,
			...(BAR_SPOTLIGHT_RADIUS === undefined ? {} : { radius: BAR_SPOTLIGHT_RADIUS })
		});
	}, [id, indexFromRight, insets.top, isFocused, registerTarget, width]);
};
