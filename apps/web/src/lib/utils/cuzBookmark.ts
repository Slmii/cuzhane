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
 * **A bookmark belongs to the round it was set in.** A group that keeps its cüz across the
 * boundary hands the same cüz back next round, and last round's page — often its last — then
 * opened the reader at the end and showed Ana sayfa a cüz already read. The round is stored with
 * the page, and a bookmark from any other round reads as none. One written before the round was
 * stored has no round to match, so it reads as none too.
 *
 * Best effort in both directions: a read that fails opens the cüz at page one, and a write
 * that fails costs one relaunch's memory. The screen is already showing the right page.
 */
const STORAGE_KEY_PREFIX = 'cuzBookmark.';

const storageKey = (userId: string, groupId: string, cuzNumber: number) =>
	`${STORAGE_KEY_PREFIX}${userId}.${groupId}.${cuzNumber}`;

type StoredBookmark = { page: number; roundIndex: number };

const parseBookmark = (raw: string | null): StoredBookmark | null => {
	if (raw === null) {
		return null;
	}

	try {
		const value: unknown = JSON.parse(raw);

		if (typeof value !== 'object' || value === null) {
			return null;
		}

		const { page, roundIndex } = value as Partial<StoredBookmark>;

		return Number.isInteger(page) && Number.isInteger(roundIndex) && (page ?? 0) > 0
			? { page: page ?? 0, roundIndex: roundIndex ?? 0 }
			: null;
	} catch {
		return null;
	}
};

/** The page saved in this round, 1-based within the cüz, or null when nothing has been marked in it. */
export const readCuzBookmark = async (
	userId: string,
	groupId: string,
	cuzNumber: number,
	roundIndex: number
): Promise<number | null> => {
	try {
		const bookmark = parseBookmark(await SecureStore.getItemAsync(storageKey(userId, groupId, cuzNumber)));

		return bookmark?.roundIndex === roundIndex ? bookmark.page : null;
	} catch {
		return null;
	}
};

export const writeCuzBookmark = async (
	userId: string,
	groupId: string,
	cuzNumber: number,
	roundIndex: number,
	page: number
): Promise<void> => {
	try {
		const bookmark: StoredBookmark = { page, roundIndex };

		await SecureStore.setItemAsync(storageKey(userId, groupId, cuzNumber), JSON.stringify(bookmark));
	} catch {
		// See above: the page on screen is already right.
	}
};
