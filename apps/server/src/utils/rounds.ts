/**
 * Rounds and the calendar they are measured against.
 *
 * Lives in utils rather than a service because both the serializer and the rollover need
 * it, and a service-to-service import between those two would be circular.
 *
 * ## Why every function here takes a time zone
 *
 * A round boundary is a *local midnight*, not a fixed instant. These were once bucketed in
 * UTC, which put the reset at 03:00 in Istanbul (tolerable) and 20:00 the previous evening
 * in New York (not): an American member's board wiped mid-evening, and their heatmap merged
 * two evenings of reading into one square. A group therefore carries the zone it lives in —
 * the owner's, captured at creation — and the day is computed there.
 *
 * The zone belongs to the *group*, not the member. A shared board needs one shared day, or
 * two members disagree about which round's reads the rollover is entitled to wipe. Personal
 * stats are the opposite case and use the viewer's own zone; see `profile.service.ts`.
 *
 * These helpers are deliberately server-only. The client never computes a round — it is
 * handed `roundIndex` — so nothing here needs mirroring into `apps/web`.
 */
/** Every cycle rolls; none is open-ended. */
export type CycleName = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Fixed-length cycles, in days. MONTHLY is not a number of days, so it is absent by construction. */
export const ROUND_DAYS: Record<'DAILY' | 'WEEKLY', number> = {
	DAILY: 1,
	WEEKLY: 7
};

const DAY_MS = 86_400_000;

/** The fallback for rows written before groups carried a zone. See the backfill migration. */
export const DEFAULT_TIME_ZONE = 'Europe/Istanbul';

const partsFormatter = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
	const cached = partsFormatter.get(timeZone);

	if (cached) {
		return cached;
	}

	// Constructing one of these is expensive relative to how often the rollover runs, and a
	// group's zone never changes, so they are worth holding on to.
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	});

	partsFormatter.set(timeZone, formatter);

	return formatter;
};

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/**
 * What a clock on the wall in `timeZone` reads at a given instant.
 *
 * Everything else is built on this rather than on offset arithmetic, which is what makes the
 * whole file DST-correct: we ask the platform what the local date *is* instead of trying to
 * derive it by adding hours.
 */
const wallClockIn = (instant: Date, timeZone: string): WallClock => {
	const parts = formatterFor(timeZone).formatToParts(instant);
	const read = (type: Intl.DateTimeFormatPartTypes): number => {
		const part = parts.find(candidate => candidate.type === type);

		return part ? Number(part.value) : 0;
	};

	return {
		year: read('year'),
		month: read('month'),
		day: read('day'),
		hour: read('hour'),
		minute: read('minute'),
		second: read('second')
	};
};

/**
 * A stable integer naming the local calendar day — days since the epoch as that zone counts
 * them. Two instants share a day number exactly when a person in that zone would call them
 * the same day, which is the only question the round math ever asks.
 */
export const civilDayNumber = (instant: Date, timeZone: string): number => {
	const { year, month, day } = wallClockIn(instant, timeZone);

	return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
};

/** How far local wall time runs ahead of UTC at a given instant, in milliseconds. */
const offsetAt = (instant: Date, timeZone: string): number => {
	const { year, month, day, hour, minute, second } = wallClockIn(instant, timeZone);
	const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);

	// Truncated to the second because the formatter has no finer resolution; comparing
	// against the raw millisecond value would fold the sub-second remainder into the offset.
	return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

const HOUR_MS = 3_600_000;

// A DST gap is normally an hour, but history has bigger ones — Samoa skipped a whole day in
// 2011 — so the walks below are bounded generously rather than tightly.
const MAX_DISAMBIGUATION_STEPS = 48;

/**
 * The instant at which a given local day begins.
 *
 * Two offset passes get the common case right: guess using the offset at the corresponding
 * UTC midnight, then re-read the offset at that guess and correct. Both edge cases where
 * local midnight is not a single well-defined instant then need explicit handling, because
 * no number of passes converges on them.
 *
 * **The gap.** Where the clocks spring forward *at* midnight — Havana, Santiago, and others
 * — 00:00 never happens, and the two-pass answer lands on the previous day (23:00 the night
 * before). Walking forward to the first instant that really is this day gives 01:00, the
 * moment the day began.
 *
 * **The overlap.** Where the clocks fall back through midnight — Gaza, Lord Howe — 00:00
 * happens twice, an hour apart, and the two-pass answer can pick the later one. That would
 * put a round's start *after* the moment the round index advanced, so a group could report a
 * round that had not begun yet. Stepping back to the first occurrence keeps
 * `roundStartedAtFor` consistent with `roundIndexSince`.
 */
export const startOfCivilDay = (dayNumber: number, timeZone: string): Date => {
	const utcMidnight = dayNumber * DAY_MS;
	const firstGuess = utcMidnight - offsetAt(new Date(utcMidnight), timeZone);
	let instant = utcMidnight - offsetAt(new Date(firstGuess), timeZone);

	for (
		let step = 0;
		step < MAX_DISAMBIGUATION_STEPS && civilDayNumber(new Date(instant), timeZone) < dayNumber;
		step++
	) {
		instant += HOUR_MS;
	}

	for (
		let step = 0;
		step < MAX_DISAMBIGUATION_STEPS && civilDayNumber(new Date(instant - HOUR_MS), timeZone) === dayNumber;
		step++
	) {
		instant -= HOUR_MS;
	}

	return new Date(instant);
};

const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/**
 * The local day on which round `roundIndex` begins, as a civil day number. Round 0's day is the start's own.
 *
 * A DAILY or WEEKLY round is a fixed number of days, so this is plain addition. A month is
 * the anchor's day-of-month in each later month, clamped: a group started on the 31st rolls
 * on Feb 28, then Mar 31 — measured from the anchor every time, never from the previous
 * boundary, or one short February would pull every later round back to the 28th.
 */
export const boundaryDayNumber = (startedAt: Date, cycle: CycleName, roundIndex: number, timeZone: string): number => {
	if (cycle !== 'MONTHLY') {
		return civilDayNumber(startedAt, timeZone) + Math.max(0, roundIndex) * ROUND_DAYS[cycle];
	}

	const { year, month, day } = wallClockIn(startedAt, timeZone);
	const target = month - 1 + Math.max(0, roundIndex);
	const targetYear = year + Math.floor(target / 12);
	const targetMonth = ((target % 12) + 12) % 12;
	const clamped = Math.min(day, daysInMonth(targetYear, targetMonth));

	return Math.floor(Date.UTC(targetYear, targetMonth, clamped) / DAY_MS);
};

/**
 * How many rounds have elapsed since the hatim began — 0 during the first one.
 *
 * Counted in whole local calendar days rather than elapsed hours, so a round turns over at
 * midnight rather than 24h after the owner happened to tap "start". A MONTHLY round is
 * counted in calendar months instead, and turns over at the start of the boundary day
 * `boundaryDayNumber` names for it.
 */
export const roundIndexSince = (startedAt: Date, cycle: CycleName, now: Date, timeZone: string): number => {
	const today = civilDayNumber(now, timeZone);
	const startDay = civilDayNumber(startedAt, timeZone);

	if (today <= startDay) {
		return 0;
	}

	if (cycle !== 'MONTHLY') {
		return Math.floor((today - startDay) / ROUND_DAYS[cycle]);
	}

	const start = wallClockIn(startedAt, timeZone);
	const current = wallClockIn(now, timeZone);
	let index = (current.year - start.year) * 12 + (current.month - start.month);

	// The month difference overshoots by one before this month's boundary day has arrived.
	while (index > 0 && boundaryDayNumber(startedAt, cycle, index, timeZone) > today) {
		index--;
	}

	return index;
};

/**
 * When a given round began.
 *
 * Round 0 begins the moment the hatim started — mid-afternoon, whenever the owner tapped.
 * Every round after that begins at a local midnight, because that is where `roundIndexSince`
 * puts the boundary. Adding raw 24h blocks to `startedAt` instead would drift by the
 * time-of-day it started, and again by an hour at every DST change.
 */
export const roundStartedAtFor = (startedAt: Date, cycle: CycleName, roundIndex: number, timeZone: string): Date =>
	roundIndex <= 0 ? startedAt : startOfCivilDay(boundaryDayNumber(startedAt, cycle, roundIndex, timeZone), timeZone);

/**
 * When round `roundIndex` runs out: the start of the next one, so the "X gün kaldı" caption
 * counts down to the reset. It is never an end date for the group itself: a hatim runs until
 * someone deletes it, not until a date.
 *
 * Measured in local days from the group's start rather than in hours from an instant, so
 * round 0 ends at the same midnight the rollover fires. Adding a fixed number of hours to
 * `startedAt` used to put this several hours after the group had already rolled.
 *
 * Takes the anchor and an index rather than the round's own start, because a clamped month
 * cannot be derived from the previous boundary: a month after Feb 28 is Mar 28, but a group
 * started on the 31st rolls on Mar 31.
 */
export const roundEndsAt = (startedAt: Date, cycle: CycleName, roundIndex: number, timeZone: string): Date =>
	startOfCivilDay(boundaryDayNumber(startedAt, cycle, Math.max(0, roundIndex) + 1, timeZone), timeZone);

/** Whether a string is a time zone this platform actually knows, for validating client input. */
export const isValidTimeZone = (timeZone: string): boolean => {
	try {
		new Intl.DateTimeFormat('en-CA', { timeZone });

		return true;
	} catch {
		return false;
	}
};
