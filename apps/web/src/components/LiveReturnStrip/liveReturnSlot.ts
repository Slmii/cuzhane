import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { Platform } from 'react-native';

/** `"26.1"` against 26.1 — iOS reports its version as a string. */
const isAtLeast = (version: string, major: number, minor: number) => {
	const [versionMajor = 0, versionMinor = 0] = version.split('.').map(Number);

	return versionMajor > major || (versionMajor === major && versionMinor >= minor);
};

/**
 * **On iOS 26 the strip is the tab bar's own accessory**, not a card floating over the screen. The
 * native tab bar takes every touch in a band well above the bar it draws (about 148pt from the
 * bottom), so a card 10pt above the bar showed but could not be tapped. The system's accessory
 * slot — where Music keeps its mini player — sits in that band and is meant to be tapped.
 * Elsewhere (Android, older iOS) the card is drawn as designed.
 *
 * **26.1 and up only**: switching the accessory on and off is safe only through
 * `tabViewBottomAccessory(isEnabled:)`, which our patch of `react-native-bottom-tabs` uses there.
 * On 26.0 the library swaps the whole tab view and the app crashes.
 */
export const isStripNativeAccessory =
	Platform.OS === 'ios' && isLiquidGlassSupported && isAtLeast(String(Platform.Version), 26, 1);

/**
 * What the focused tab says about the strip: whether it is due there, the way back, and — for the
 * drawn card — how far above the window's bottom edge it sits. `stripHeight` goes the other way:
 * the card, drawn once above the tabs, reports how tall it came out, and every tab leaves its
 * content that much room.
 */
export type LiveReturnSlot = { isDue: boolean; onReturn: () => void; bottom: number; stripHeight: number };

let current: LiveReturnSlot = { bottom: 0, isDue: false, onReturn: () => undefined, stripHeight: 0 };
const listeners = new Set<() => void>();

const isSame = (a: LiveReturnSlot, b: LiveReturnSlot) =>
	a.isDue === b.isDue && a.onReturn === b.onReturn && a.bottom === b.bottom && a.stripHeight === b.stripHeight;

/**
 * **One slot for the whole app**, filled by the focused tab's host and read by what draws the
 * strip once for every tab — the iOS accessory, or the card above the tab bar elsewhere. Drawn in
 * each tab, the card left with the old tab and came back with the new one on every switch.
 */
export const liveReturnSlot = {
	get: () => current,
	/** Merged into what is there, so the host and the card can each write their own half. */
	set: (next: Partial<LiveReturnSlot>) => {
		const merged = { ...current, ...next };

		if (isSame(merged, current)) {
			return;
		}

		current = merged;
		listeners.forEach(listener => listener());
	},
	subscribe: (listener: () => void) => {
		listeners.add(listener);

		return () => listeners.delete(listener);
	}
};
