import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTour } from './Tour.context';
import type { TourTargetId } from './tourSteps';

type TourTargetProps = {
	id: TourTargetId;
	children: ReactNode;
	style?: ViewStyle;
};

/**
 * Marks a piece of the UI as something the tour can point at.
 *
 * **`measureInWindow`, not `onLayout`'s own numbers.** `onLayout` reports a box relative to the
 * parent, and the scrim is a full-screen `Modal` — the two only agree on a screen with no
 * header, no inset and no scroll offset, which is no screen in this app. `measureInWindow` is
 * the only measurement in the same coordinate space the overlay draws in.
 *
 * **Focus, not mount, is what decides whether a rectangle is live.** Unmounting looked like the
 * obvious moment to withdraw one and is almost never reached: the tabs are not lazy and Profil
 * is pushed *inside* a tab, so Ana sayfa stays mounted behind whatever is on top of it. A rect
 * withdrawn only on unmount meant replaying the tour from Profil cut a hole over Profil at Ana
 * sayfa's coordinates. Blur is the honest signal that the thing being pointed at is no longer
 * in front of anyone.
 *
 * **And it re-measures when the tour opens, not only on layout.** `onLayout` fires when this
 * view's own box changes, which is not the same as this view having moved: Ana sayfa's streak
 * card is absent until the stats land, and it arrives *above* the group rows, pushing them down
 * without altering their box inside the scroller. Measuring again at the moment a rect is
 * actually needed is what keeps the spotlight off the gap the card left behind.
 */
export const TourTarget = ({ children, id, style }: TourTargetProps) => {
	const { isActive, registerTarget } = useTour();
	const isFocused = useIsFocused();
	const ref = useRef<View | null>(null);

	const measure = useCallback(() => {
		if (!isFocused) {
			return;
		}

		ref.current?.measureInWindow((x, y, width, height) => {
			if (width === 0 && height === 0) {
				return;
			}

			registerTarget(id, { height, width, x, y });
		});
	}, [id, isFocused, registerTarget]);

	useEffect(() => {
		if (!isFocused) {
			registerTarget(id, null);
			return;
		}

		measure();
	}, [id, isActive, isFocused, measure, registerTarget]);

	useEffect(() => () => registerTarget(id, null), [id, registerTarget]);

	return (
		<View collapsable={false} onLayout={measure} ref={ref} {...(style ? { style } : {})}>
			{children}
		</View>
	);
};
