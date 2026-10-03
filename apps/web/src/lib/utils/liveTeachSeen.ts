import * as SecureStore from 'expo-secure-store';

/**
 * Whether this phone has shown "Göster"'s hint — "tap the line you're reading" — under the live
 * row. The design shows it in the first reading together only, and never again.
 *
 * **On the device**, like `roundScreensSeen`: a second phone or a reinstall shows it once more,
 * which costs a sentence and needs no server state. Best effort both ways: a failed read shows it
 * again, a failed write shows it next time.
 */
const STORAGE_KEY = 'liveTeachSeen';

export const hasSeenLiveTeach = async (): Promise<boolean> => {
	try {
		return (await SecureStore.getItemAsync(STORAGE_KEY)) !== null;
	} catch {
		return false;
	}
};

export const markLiveTeachSeen = async (): Promise<void> => {
	try {
		await SecureStore.setItemAsync(STORAGE_KEY, '1');
	} catch {
		// See above: the hint shows once more next time.
	}
};
