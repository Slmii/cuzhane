import type { HizbReadingState } from '@/api/hizbReading.api';

const DAY_MS = 86_400_000;

/** Whole days from one group-local civil date ("2026-10-02") to another. */
export const civilDaysBetween = (from: string, to: string): number =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/**
 * What a Hizb plan's "Benim ilerlemem" shows past today.
 *
 * - `offer`: the one day to read ahead, only once today's is read, and only what the server
 *   offers; `daysAway` is 1 for tomorrow.
 * - `through`: how far ahead the reader already is — a row under the offer that opens the days read ahead; no undo.
 * - Today's undo only while no day after it is read (the server refuses it otherwise).
 */
export const hizbAheadView = (
	state: Pick<HizbReadingState, 'ahead' | 'aheadThrough' | 'date'> & { today: { completedAt: string | null } | null }
) => {
	const isTodayRead = state.today?.completedAt != null;
	const offer = isTodayRead ? state.ahead ?? null : null;
	const through = state.aheadThrough ?? null;

	return {
		canUndoToday: isTodayRead && through === null,
		offer: offer ? { ...offer, daysAway: civilDaysBetween(state.date, offer.date) } : null,
		through
	};
};

/**
 * Whether a read day can be undone from the reader. A day read ahead never is — the app offers no
 * undo for reading ahead — and today only while nothing after it is read; a missed day caught up
 * stands apart from them. With no state at hand, the server is left to decide.
 */
export const canUndoHizbDay = (
	date: string,
	state: Pick<HizbReadingState, 'aheadThrough' | 'date'> | undefined
): boolean => {
	if (!state) {
		return true;
	}

	return date < state.date || (date === state.date && !state.aheadThrough);
};

/**
 * Whether a day was read before it came round — read ahead. Its own civil date against the
 * calendar day it was read on, both in the group's zone ("en-CA" formats as YYYY-MM-DD).
 */
export const isReadBeforeItsDay = (completedAt: string | null, date: string, timeZone: string): boolean =>
	completedAt !== null && new Date(completedAt).toLocaleDateString('en-CA', { timeZone }) < date;
