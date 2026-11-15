import * as SecureStore from 'expo-secure-store';

/**
 * Where an earlier build kept, on the phone, that "Birlikte oku"'s hint had been shown. The hint
 * is an account's now (`freeReader.live`); this is read once to carry the flag over and then
 * deleted — see `HintsProvider`. Best effort: a failed read imports nothing, a failed delete
 * imports it again next launch, which is harmless.
 */
const STORAGE_KEY = 'liveHintSeen';

export const hasSeenLiveHint = async (): Promise<boolean> => {
	try {
		return (await SecureStore.getItemAsync(STORAGE_KEY)) !== null;
	} catch {
		return false;
	}
};

export const clearLiveHintSeen = async (): Promise<void> => {
	try {
		await SecureStore.deleteItemAsync(STORAGE_KEY);
	} catch {
		// See above.
	}
};
