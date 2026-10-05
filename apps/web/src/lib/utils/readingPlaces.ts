import { type ReadingPlacePatch, saveReadingPlace } from '@/api/groups.api';
import type { ReadingPlace, ReadingPlaces } from '@/lib/types/domain';

/**
 * The reader's place in a board group's unit — a cüz's page, a Hizb portion's — and a cüz's pages
 * read, **kept on the server** so they follow the reader to any device. The device keeps its own
 * copy too (`cuzBookmark`, `cuzPagesRead`), for while the server has not answered or cannot.
 *
 * Saves never hold a page turn up: they are queued here and sent one at a time per unit, a turn
 * made while one is in flight folded into the next — so quick turns cost a request or two, not
 * one each, and an older place can never land after a newer one.
 */

const higher = (a: number | undefined, b: number | undefined) =>
	a === undefined ? b : b === undefined ? a : Math.max(a, b);

/** Two saves as one: the later place, and the higher of each count. */
export const mergePlacePatch = (earlier: ReadingPlacePatch, later: ReadingPlacePatch): ReadingPlacePatch => ({
	position: later.position ?? earlier.position,
	textPagesRead: higher(earlier.textPagesRead, later.textPagesRead),
	husrevPagesRead: higher(earlier.husrevPagesRead, later.husrevPagesRead)
});

/** The cached places with a save applied as the server will apply it; another round's are left alone. */
export const applyPlacePatch = (
	cached: ReadingPlaces | undefined,
	roundIndex: number,
	unitNumber: number,
	patch: ReadingPlacePatch
): ReadingPlaces | undefined => {
	if (cached && cached.roundIndex !== roundIndex) {
		return cached;
	}

	const places = cached?.places ?? [];
	const existing = places.find(place => place.unitNumber === unitNumber);
	const next: ReadingPlace = {
		unitNumber,
		position: patch.position ?? existing?.position ?? null,
		textPagesRead: higher(existing?.textPagesRead, patch.textPagesRead) ?? 0,
		husrevPagesRead: higher(existing?.husrevPagesRead, patch.husrevPagesRead) ?? 0
	};

	return {
		roundIndex,
		places: existing
			? places.map(place => (place === existing ? next : place))
			: [...places, next].sort((a, b) => a.unitNumber - b.unitNumber)
	};
};

/**
 * The server's place in one unit, for the round asked about: the place, null when it holds none,
 * undefined while it has not answered (or answered for another round).
 */
export const placeIn = (
	cached: ReadingPlaces | undefined,
	roundIndex: number | null,
	unitNumber: number
): ReadingPlace | null | undefined => {
	if (!cached || roundIndex === null || cached.roundIndex !== roundIndex) {
		return undefined;
	}

	return cached.places.find(place => place.unitNumber === unitNumber) ?? null;
};

type Save = { groupId: string; unitNumber: number; patch: ReadingPlacePatch };

const queued = new Map<string, Save>();
const sending = new Set<string>();

const send = async (key: string): Promise<void> => {
	const save = queued.get(key);

	if (!save || sending.has(key)) {
		return;
	}

	queued.delete(key);
	sending.add(key);

	try {
		await saveReadingPlace(save);
	} catch {
		// Best effort: the device keeps its copy, and the next turn saves again.
	} finally {
		sending.delete(key);
	}

	return send(key);
};

/** Queues a save, sending it now unless one for the same unit is in flight. Never rejects. */
export const queueReadingPlaceSave = (save: Save): Promise<void> => {
	const key = `${save.groupId}:${save.unitNumber}`;
	const earlier = queued.get(key);

	queued.set(key, earlier ? { ...save, patch: mergePlacePatch(earlier.patch, save.patch) } : save);

	return send(key);
};
