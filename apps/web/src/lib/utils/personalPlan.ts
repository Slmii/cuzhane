import type { GroupKind } from '@/lib/types/domain';
import { babNumbersForSlot } from '@/lib/utils/babs';
import { isPersonalPlan, partCountFor, PERSONAL_PLAN_MAX_DAYS } from '@/lib/utils/groupKinds';

/*
 * A Şahsi (one person's) Cevşen or Kur'an reading: the book split over `planDays` days the way
 * seats split it (`rangeForSlot`) — the first days one longer when it does not divide evenly —
 * and read again from the start after the last day. The server cuts a day the same way
 * (`unitsOfDay` in `hizbReading.service.ts`).
 */

export type PersonalPlanKind = keyof typeof PERSONAL_PLAN_MAX_DAYS;

/** The plan lengths the create sheet offers as cards; any other length is typed on its stepper. */
export const PLAN_DAY_PRESETS = [10, 15, 30] as const;

/** Where the custom card's stepper starts — off every preset, so tapping the card lights itself. */
export const CUSTOM_PLAN_DAYS = 20;

/** Every length the custom stepper walks for a kind: one day up to its maximum. */
export const planDayValues = (kind: PersonalPlanKind) =>
	Array.from({ length: PERSONAL_PLAN_MAX_DAYS[kind] }, (_, index) => index + 1);

/** Whether a kind can be read as a Şahsi plan by days (the Hizb has its own plans). */
export const isPersonalPlanKind = (kind: GroupKind): kind is PersonalPlanKind => kind !== 'HIZB';

/**
 * Whether a group is read by day plans — `isPersonalPlan` for the client's optional fields. A group
 * from an older server, with neither field, is a board.
 */
export const isPersonalPlanGroup = (group: { hizbPlan?: number | null; planDays?: number | null }) =>
	isPersonalPlan({ hizbPlan: group.hizbPlan ?? null, planDays: group.planDays ?? null });

/** A plan day's babs or cüz; `portion` is the plan's day, 1-based. */
export const planUnitsOf = (kind: PersonalPlanKind, planDays: number, portion: number): number[] =>
	babNumbersForSlot(portion - 1, planDays, partCountFor(kind));

/**
 * What a plan length comes to a day: `perDay` on the first days, and — when the book does not
 * divide evenly — `lastPerDay` (one fewer) on the last `lastDays`. "Günde 7 bab · son 5 gün 6".
 */
export const planSplit = (
	kind: PersonalPlanKind,
	planDays: number
): { perDay: number; lastDays: number; lastPerDay: number } => {
	const total = partCountFor(kind);
	const base = Math.floor(total / planDays);
	const longer = total % planDays;

	return longer === 0
		? { lastDays: 0, lastPerDay: base, perDay: base }
		: { lastDays: planDays - longer, lastPerDay: base, perDay: base + 1 };
};

/** Which screen opens a plan day: the Hizb's reader, the Cevşen's, or the cüz reader on the day's cüz. */
export const planReadingRoute = (kind: GroupKind) =>
	kind === 'CEVSEN' ? 'CevsenPlanReader' : kind === 'HATIM' ? 'CuzReader' : 'HizbPlanReader';

/**
 * Pages kept per cüz in a Kur'an day's place (`bookmark`). A cüz has at most 25 pages in either
 * mushaf, so 30 leaves room, and a thirty-cüz day still fits the server's cap of 1000.
 */
const PAGES_PER_CUZ_SLOT = 30;

/** A Kur'an day's place as its reading's `bookmark`: which of the day's cüz, and the page in it (1-based). */
export const cuzPlaceToBookmark = (cuzIndex: number, page: number) => cuzIndex * PAGES_PER_CUZ_SLOT + page;

/** The place a Kur'an day's `bookmark` keeps — `null` when nothing is marked yet (0). */
export const bookmarkToCuzPlace = (bookmark: number): { cuzIndex: number; page: number } | null => {
	if (bookmark <= 0) {
		return null;
	}

	const cuzIndex = Math.floor((bookmark - 1) / PAGES_PER_CUZ_SLOT);

	return { cuzIndex, page: bookmark - cuzIndex * PAGES_PER_CUZ_SLOT };
};

/**
 * How far into a Kur'an day, in pages: each cüz marked read is all of its pages, and the place kept
 * adds the pages up to it in the cüz not yet marked. `pagesOf` is the mushaf the reader is set to.
 * One count for the group screen and the shelf's card, so the two never disagree.
 */
export const quranDayPages = (
	cuzNumbers: readonly number[],
	marked: readonly number[],
	bookmark: number,
	pagesOf: (cuzNumber: number) => number
): { read: number; total: number } => {
	const total = cuzNumbers.reduce((sum, n) => sum + pagesOf(n), 0);
	const done = cuzNumbers.filter(n => marked.includes(n)).reduce((sum, n) => sum + pagesOf(n), 0);
	const place = bookmarkToCuzPlace(bookmark);
	const placeCuz = place ? cuzNumbers[place.cuzIndex] : undefined;
	const upToPlace =
		place && placeCuz !== undefined && !marked.includes(placeCuz)
			? cuzNumbers
					.slice(0, place.cuzIndex)
					.filter(n => !marked.includes(n))
					.reduce((sum, n) => sum + pagesOf(n), 0) + place.page
			: 0;

	return { read: Math.min(total, done + upToPlace), total };
};
