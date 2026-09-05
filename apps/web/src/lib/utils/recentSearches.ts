import * as SecureStore from 'expo-secure-store';
import { useEffect, useSyncExternalStore } from 'react';

const MAX_RECENT_SEARCHES = 6;
/**
 * A query longer than this is cut before it is stored, and the field refuses more. iOS caps a
 * SecureStore value at 2048 bytes; six entries of eighty characters stay under it even when
 * every character is two bytes, which Turkish mostly is.
 */
export const MAX_SEARCH_QUERY_LENGTH = 80;
/** One list per account: the key carries the Clerk user id, so accounts never see each other's. */
const STORAGE_KEY_PREFIX = 'recentSearches.';

/**
 * The searches that led somewhere, newest first — what K2 lists under "SON ARAMALAR" when the
 * field is empty.
 *
 * **On the device, per account.** Stored in `expo-secure-store` like the theme and language,
 * under a key that carries the signed-in user's id — so a second account on the same phone
 * starts with an empty list, and signing out empties what is shown without touching what is
 * stored. It was session memory first; that lasted only until the app was quit. A query joins
 * the list when a result is opened, not on every keystroke — a recent search is one that found
 * something.
 *
 * The module holds the *active* user's list and hands it to React through
 * `useSyncExternalStore`. Every read of it is checked against the user asking: a screen that
 * mounts for a new account before the effect has switched the list sees an empty one, never
 * the previous account's.
 */
let activeUserId: string | null = null;
/** The user whose list has finished loading — `activeUserId` while a read is still in flight. */
let loadedUserId: string | null = null;
let recentSearches: readonly string[] = [];
const EMPTY: readonly string[] = [];
const listeners = new Set<() => void>();
/** Writes go out one after another, so two quick additions cannot land in the wrong order. */
let pendingWrite: Promise<void> = Promise.resolve();

const emit = () => listeners.forEach(listener => listener());

const storageKey = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`;

const parseStored = (raw: string | null): readonly string[] => {
	if (raw === null) {
		return EMPTY;
	}

	try {
		const parsed: unknown = JSON.parse(raw);

		return Array.isArray(parsed)
			? parsed
					.filter((entry): entry is string => typeof entry === 'string')
					.map(entry => entry.slice(0, MAX_SEARCH_QUERY_LENGTH))
			: EMPTY;
	} catch {
		return EMPTY;
	}
};

/** Newest first, no repeats, at most six. */
const merge = (newest: readonly string[], older: readonly string[]) =>
	[...newest, ...older.filter(entry => !newest.includes(entry))].slice(0, MAX_RECENT_SEARCHES);

const setRecentSearches = (next: readonly string[]) => {
	recentSearches = next;
	emit();
};

const persist = (userId: string, entries: readonly string[]) => {
	// Best effort: the list on screen is already right, and a write that fails costs one relaunch's memory.
	pendingWrite = pendingWrite
		.then(() => SecureStore.setItemAsync(storageKey(userId), JSON.stringify(entries)))
		.catch(() => undefined);
};

/**
 * Makes `userId`'s list the active one, reading it off the device. A sign-out (`null`) empties
 * the list shown. The load is async, so a user change mid-read is checked for before applying.
 */
const activateUser = async (userId: string | null) => {
	/*
	 * Already this user's list, already read: nothing to do. The screen mounts again on every
	 * push on Android, and blanking and re-reading each time flashed the list — and a search
	 * opened during that gap would have been written over an empty list, wiping the stored six.
	 */
	if (userId === activeUserId && loadedUserId === userId) {
		return;
	}

	activeUserId = userId;
	loadedUserId = null;
	setRecentSearches(EMPTY);

	if (userId === null) {
		return;
	}

	let stored: readonly string[] = EMPTY;

	try {
		stored = parseStored(await SecureStore.getItemAsync(storageKey(userId)));
	} catch {
		// A store that cannot be read is an empty history, not a broken screen.
	}

	if (activeUserId !== userId) {
		return;
	}

	loadedUserId = userId;
	// A search opened while the read was in flight is already in memory; it goes in front of
	// what was stored rather than being replaced by it.
	const combined = merge(recentSearches, stored);
	setRecentSearches(combined);

	if (combined.length !== stored.length) {
		persist(userId, combined);
	}
};

/** Records `query` for `userId` — ignored while signed out or for an account that is not the active one. */
export const addRecentSearch = (userId: string | null, query: string) => {
	const trimmed = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);

	if (trimmed === '' || userId === null || userId !== activeUserId) {
		return;
	}

	const next = merge([trimmed], recentSearches);
	setRecentSearches(next);
	persist(userId, next);
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
};

/** The signed-in user's recent searches; `null` while signed out, which shows none. */
export const useRecentSearches = (userId: string | null) => {
	useEffect(() => {
		void activateUser(userId);
	}, [userId]);

	// Read against the caller's user: before the effect above has switched the list, or with
	// no user at all, the answer is empty rather than whoever's list is still in memory.
	const getSnapshot = () => (userId !== null && userId === activeUserId ? recentSearches : EMPTY);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
