import * as SecureStore from 'expo-secure-store';

/**
 * Whether this phone has shown the tour's hint at "Birlikte oku" — the one card over the free
 * readers' bar button. Shown once per phone, in whichever free reader is opened first, and never
 * again.
 *
 * **On the device**, like `liveTeachSeen`: a second phone or a reinstall shows it once more, which
 * costs a card and needs no server state. Best effort both ways: a failed read shows it again, a
 * failed write shows it next time.
 */
const STORAGE_KEY = 'liveHintSeen';

export const hasSeenLiveHint = async (): Promise<boolean> => {
	try {
		return (await SecureStore.getItemAsync(STORAGE_KEY)) !== null;
	} catch {
		return false;
	}
};

export const markLiveHintSeen = async (): Promise<void> => {
	try {
		await SecureStore.setItemAsync(STORAGE_KEY, '1');
	} catch {
		// See above: the hint shows once more next time.
	}
};
