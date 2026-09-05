import { useSyncExternalStore } from 'react';

/**
 * An early "hide the bar" signal, ahead of the navigation state.
 *
 * `TabsNavigator` hides the bar from the *focused route*, and that route only becomes the search
 * screen once a pop has committed — by which time the screen is already on view, and the bar
 * was seen sliding out of it. A pop's native transition starts before the state changes, and
 * the screen coming back into view is told (`transitionStart`, not closing), so the search
 * screen raises this flag at that moment and the bar is gone before the page is.
 *
 * Module state rather than context: the navigator that reads it sits above every screen that
 * could set it, and a context would have to be threaded through the tab and stack navigators.
 */
let isForcedHidden = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
};

export const forceTabBarHidden = (value: boolean) => {
	if (isForcedHidden === value) {
		return;
	}

	isForcedHidden = value;
	listeners.forEach(listener => listener());
};

export const useForcedTabBarHidden = () => useSyncExternalStore(subscribe, () => isForcedHidden);
