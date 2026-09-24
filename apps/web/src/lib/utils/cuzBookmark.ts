import * as SecureStore from 'expo-secure-store';

/**
 * "Kaldığım yeri işaretle" — the page a reader stopped on in a cüz, kept on the device.
 *
 * **Device-local, like the recent searches**, and for the same reasons: it is a convenience
 * for the person holding this phone, nobody else needs it, and a server column for "which
 * page of cüz 22 was I on" would be a lot of schema for a bookmark. Keyed on the account,
 * the group and the cüz, so two groups reading the same cüz keep separate places and a
 * sign-out shows none.
 *
 * Best effort in both directions: a read that fails opens the cüz at page one, and a write
 * that fails costs one relaunch's memory. The screen is already showing the right page.
 */
const STORAGE_KEY_PREFIX = 'cuzBookmark.';

const storageKey = (userId: string, groupId: string, cuzNumber: number) =>
	`${STORAGE_KEY_PREFIX}${userId}.${groupId}.${cuzNumber}`;

/** The saved page, 1-based within the cüz, or null when nothing has been marked. */
export const readCuzBookmark = async (userId: string, groupId: string, cuzNumber: number): Promise<number | null> => {
	try {
		const raw = await SecureStore.getItemAsync(storageKey(userId, groupId, cuzNumber));
		const page = raw === null ? Number.NaN : Number(raw);

		return Number.isInteger(page) && page > 0 ? page : null;
	} catch {
		return null;
	}
};

export const writeCuzBookmark = async (
	userId: string,
	groupId: string,
	cuzNumber: number,
	page: number
): Promise<void> => {
	try {
		await SecureStore.setItemAsync(storageKey(userId, groupId, cuzNumber), String(page));
	} catch {
		// See above: the page on screen is already right.
	}
};
