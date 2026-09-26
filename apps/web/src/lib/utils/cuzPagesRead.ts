import * as SecureStore from 'expo-secure-store';

/** The two paginations a cüz can be read in: the typeset Madinah pages, or Hüsrev's own twenty. */
export type CuzPagination = 'text' | 'husrev';

/**
 * How far into a cüz the reader has got this round — Ana sayfa's "4/20 s".
 *
 * **Pages read, not a bookmark.** "Kaldığım yeri işaretle" (`cuzBookmark`) is a place the reader
 * chooses to keep; this is what they have actually turned through in the in-app reader: a page
 * counts once it has been turned past, and crossing into the next cüz counts the one left as
 * read to its end. The furthest so far is kept, so paging back does not take progress away.
 *
 * Kept **per pagination**, because the two count different pages — seven typeset pages are not
 * seven of Hüsrev's — and Ana sayfa shows the one the reader has chosen. Kept for **one round**,
 * like the bookmark: a group that keeps its cüz hands the same cüz back next round, unread.
 *
 * Device-local, for the same reasons as the bookmark, and best effort both ways.
 */
const STORAGE_KEY_PREFIX = 'cuzPagesRead.';

type StoredProgress = { roundIndex: number } & Record<CuzPagination, number>;

const storageKey = (userId: string, groupId: string, cuzNumber: number) =>
	`${STORAGE_KEY_PREFIX}${userId}.${groupId}.${cuzNumber}`;

const readStored = async (userId: string, groupId: string, cuzNumber: number): Promise<StoredProgress | null> => {
	try {
		const raw = await SecureStore.getItemAsync(storageKey(userId, groupId, cuzNumber));
		const value: unknown = raw === null ? null : JSON.parse(raw);

		if (typeof value !== 'object' || value === null) {
			return null;
		}

		const { husrev, roundIndex, text } = value as Partial<StoredProgress>;

		return Number.isInteger(roundIndex) && Number.isInteger(husrev) && Number.isInteger(text)
			? { husrev: husrev ?? 0, roundIndex: roundIndex ?? 0, text: text ?? 0 }
			: null;
	} catch {
		return null;
	}
};

/*
 * **Writes run one at a time, and reads wait for them.** A write reads the stored count before
 * raising it, so two quick page turns both read the old count and the lower one could land last;
 * and Ana sayfa, re-reading on focus right after a turn, read ahead of the write still in flight.
 */
let pendingWrites: Promise<void> = Promise.resolve();

/** Pages of this cüz read in this round, in the given pagination — 0 when none. */
export const readCuzPagesRead = async (
	userId: string,
	groupId: string,
	cuzNumber: number,
	roundIndex: number,
	pagination: CuzPagination
): Promise<number> => {
	await pendingWrites;

	const stored = await readStored(userId, groupId, cuzNumber);

	return stored?.roundIndex === roundIndex ? stored[pagination] : 0;
};

const writePagesRead = async (
	userId: string,
	groupId: string,
	cuzNumber: number,
	roundIndex: number,
	pagination: CuzPagination,
	pages: number
): Promise<void> => {
	const stored = await readStored(userId, groupId, cuzNumber);
	const current: StoredProgress = stored?.roundIndex === roundIndex ? stored : { husrev: 0, roundIndex, text: 0 };

	if (pages <= current[pagination]) {
		return;
	}

	try {
		await SecureStore.setItemAsync(
			storageKey(userId, groupId, cuzNumber),
			JSON.stringify({ ...current, [pagination]: pages })
		);
	} catch {
		// Best effort: the next page turn records it again.
	}
};

/** Raises the count to `pages` if that is further than before; a new round starts from nothing. */
export const recordCuzPagesRead = (
	userId: string,
	groupId: string,
	cuzNumber: number,
	roundIndex: number,
	pagination: CuzPagination,
	pages: number
): Promise<void> => {
	pendingWrites = pendingWrites.then(() => writePagesRead(userId, groupId, cuzNumber, roundIndex, pagination, pages));

	return pendingWrites;
};
