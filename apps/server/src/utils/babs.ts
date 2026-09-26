/**
 * The Cevşen is 100 babs — and that is all this says. It is the Cevşen's count, not every
 * group's: a Hizb group divides 33 parts. Nothing in the seat math below reads it; every
 * function takes the group's own part count, so a caller cannot quietly split the wrong book.
 */
export const BAB_COUNT = 100;

export type BabRange = {
	start: number;
	end: number;
};

/**
 * Splits 1..partCount across `spots` seats as evenly as possible: the first
 * `partCount % spots` seats get one extra part. Seat index is 0-based and stable,
 * so a member keeps the same range for the life of the group.
 */
export const rangeForSlot = (slotIndex: number, spots: number, partCount: number): BabRange | null => {
	if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= spots || spots <= 0 || partCount <= 0) {
		return null;
	}

	const base = Math.floor(partCount / spots);
	const remainder = partCount % spots;

	// Seats before the remainder cutoff carry `base + 1` babs; the rest carry `base`.
	const extrasBefore = Math.min(slotIndex, remainder);
	const start = slotIndex * base + extrasBefore + 1;
	const size = base + (slotIndex < remainder ? 1 : 0);

	if (size <= 0) {
		return null;
	}

	return { start, end: start + size - 1 };
};

export const babNumbersForSlot = (slotIndex: number, spots: number, partCount: number): number[] => {
	const range = rangeForSlot(slotIndex, spots, partCount);

	if (!range) {
		return [];
	}

	return Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
};

// `roundIndexSince` and `roundStartedAtFor` used to live here. They moved to
// `utils/rounds.ts` when round boundaries became time-zone aware: they are the only
// functions in the round math that need a zone, they are server-only (the client is handed
// a `roundIndex` and never computes one), and keeping them here would have dragged the
// whole Intl-based calendar into the web mirror of this file for no reader.

/**
 * Which seat's block a member reads in a given round. A ROTATION group advances by a
 * whole seat per round, not by a fixed number of babs — that is what keeps the parts tiled
 * exactly when `spots` doesn't divide evenly (100 over 12 seats: four of 9, eight of 8).
 *
 * Per *round*, not per day: a WEEKLY group holds one range for the whole week and moves
 * on at the boundary. A FIXED group never rotates, so callers pass `roundIndex: 0`.
 */
export const rotatedSlot = (slotIndex: number, spots: number, roundIndex: number): number | null => {
	if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= spots || spots <= 0) {
		return null;
	}

	// `roundIndex` can exceed `spots` on a long-running group; the modulo wraps it.
	return (slotIndex + Math.max(0, Math.floor(roundIndex))) % spots;
};

export const rangeForRound = (
	slotIndex: number,
	spots: number,
	roundIndex: number,
	partCount: number
): BabRange | null => {
	const slot = rotatedSlot(slotIndex, spots, roundIndex);

	return slot === null ? null : rangeForSlot(slot, spots, partCount);
};

export const babNumbersForRound = (
	slotIndex: number,
	spots: number,
	roundIndex: number,
	partCount: number
): number[] => {
	const slot = rotatedSlot(slotIndex, spots, roundIndex);

	return slot === null ? [] : babNumbersForSlot(slot, spots, partCount);
};

/**
 * The inverse of `rangeForSlot`: which seat owns a given bab. Used to turn a bab the
 * reader is looking at back into the pool slot it belongs to.
 */
export const slotIndexForBab = (babNumber: number, spots: number, partCount: number): number | null => {
	if (!Number.isInteger(babNumber) || babNumber < 1 || babNumber > partCount || spots <= 0) {
		return null;
	}

	for (let slot = 0; slot < spots; slot++) {
		const range = rangeForSlot(slot, spots, partCount);

		if (range && babNumber >= range.start && babNumber <= range.end) {
			return slot;
		}
	}

	return null;
};

/** Parts per person, rounded — used for the "20 kişi · 5 bab/kişi" caption. */
export const babsPerPerson = (spots: number, partCount: number) => (spots > 0 ? Math.round(partCount / spots) : 0);

/**
 * The unbroken stretches in a set of bab numbers, in order: `[1..5, 12]` → `[1–5, 12–12]`.
 *
 * A share is one stretch in the ordinary case and several once the pool is involved —
 * volunteering for a block puts a second, unconnected range in your hands. Both the label
 * and the "current slice, plus N more" summary are built from this, so they can't disagree
 * about where one range ends and the next begins.
 */
export const babRuns = (numbers: number[]): BabRange[] => {
	if (numbers.length === 0) {
		return [];
	}

	const sorted = [...numbers].sort((a, b) => a - b);
	const runs: BabRange[] = [];
	let start = sorted[0] as number;
	let previous = start;

	for (const current of sorted.slice(1)) {
		if (current === previous + 1) {
			previous = current;
			continue;
		}

		runs.push({ start, end: previous });
		start = current;
		previous = current;
	}

	runs.push({ start, end: previous });

	return runs;
};

/** One run as the design writes it: "12" when it is a single bab, "1–5" otherwise. */
export const formatRun = (run: BabRange) => (run.start === run.end ? `${run.start}` : `${run.start}–${run.end}`);

/** Renders a set of bab numbers as "1–5", or "1–5, 12" when it isn't contiguous. */
export const formatBabRange = (numbers: number[]): string =>
	numbers.length === 0 ? '—' : babRuns(numbers).map(formatRun).join(', ');

export const progressPercent = (read: number, total: number) =>
	total <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((read / total) * 100)));
