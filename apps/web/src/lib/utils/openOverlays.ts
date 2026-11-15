import { useEffect, useSyncExternalStore } from 'react';

/*
 * How many sheets and menus are on screen right now. A count rather than a flag: a sheet can open
 * while another is still animating away.
 */
let openCount = 0;
const listeners = new Set<() => void>();

const notify = () => {
	for (const listener of listeners) {
		listener();
	}
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);

	return () => listeners.delete(listener);
};

const getSnapshot = () => openCount > 0;

/**
 * Says "something is open over the screen" for as long as `isOpen` is true — `ui/BottomSheet` and
 * `ui/MenuAction` call it, so the hints never put a card over either.
 */
export const useRegisterOpenOverlay = (isOpen: boolean) => {
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		openCount += 1;
		notify();

		return () => {
			openCount -= 1;
			notify();
		};
	}, [isOpen]);
};

/** Whether any sheet or menu is open. */
export const useIsAnyOverlayOpen = () => useSyncExternalStore(subscribe, getSnapshot);
