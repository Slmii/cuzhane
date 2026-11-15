import { isRepeatingCycle, type GroupCycle, type GroupKind } from '@/lib/types/domain';
/**
 * When a round rolls over, said twice: once in the group's day and once in the reader's.
 *
 * The boundary is a local midnight in the group's zone, so the group-side time is always
 * 00:00 — what varies is the zone it is midnight *in*, which weekday a WEEKLY group lands on,
 * and which day of the month a MONTHLY one does. The reader-side line is the same instant
 * expressed where they are standing, which is the whole point: a Turkish group resetting at
 * midnight is 18:00 the previous day in New York, and without saying so the countdown looks
 * wrong to everyone abroad.
 *
 * Both come from `Intl`, so the weekday and the zone abbreviation are already localised —
 * no weekday table to keep in two languages.
 */
export type RoundResetLabels = {
	/** e.g. "Her gün 00:00 GMT+3" — the group's own clock. */
	group: string;
	/** e.g. "sende 18:00" — the same moment where the reader is. */
	local: string;
};

export const timeIn = (instant: Date, locale: string, timeZone?: string) =>
	new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		...(timeZone ? { timeZone } : {})
	}).format(instant);

/**
 * The weekday, cased the way the language wants it mid-sentence.
 *
 * `Intl` capitalises Turkish weekday names, but the design writes them lowercase inside a
 * sentence ("Her cuma", "sende perşembe") — which is correct Turkish. English keeps its
 * capital. `toLocaleLowerCase` rather than `toLowerCase` because Turkish has a dotless ı.
 */
const weekdayIn = (instant: Date, locale: string, timeZone?: string) => {
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		...(timeZone ? { timeZone } : {})
	}).format(instant);

	return locale.startsWith('tr') ? weekday.toLocaleLowerCase(locale) : weekday;
};

/**
 * The day of the month an instant falls on in a zone — the number a MONTHLY group's reset line
 * names. Read in the group's zone, because that is where the month turns: a start at 01:00 on
 * the 31st in Istanbul is still the 30th in UTC.
 */
const dayOfMonthIn = (instant: Date, timeZone: string) =>
	new Intl.DateTimeFormat('en-CA', { day: 'numeric', timeZone }).format(instant);

/** "30 September" / "30 Eylül" — which day, when a weekday cannot say which month. */
const dayAndMonthIn = (instant: Date, locale: string) =>
	new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(instant);

/**
 * The zone's short name — "GMT+3" for Istanbul, "EDT" for New York. Read from the formatted
 * parts rather than hardcoded: the design's mock said "CEST" because its example group was
 * European, but the real abbreviation depends on the group and the season.
 *
 * `shortOffset` first because plain `short` collapses to a bare "GMT" on Hermes for zones
 * it has no abbreviation for, which is worse than useless — it names the wrong zone. Older
 * engines reject the option outright, hence the fallback.
 */
export const zoneAbbreviation = (instant: Date, locale: string, timeZone: string): string => {
	const read = (timeZoneName: 'shortOffset' | 'short') => {
		try {
			return (
				new Intl.DateTimeFormat(locale, { timeZone, timeZoneName })
					.formatToParts(instant)
					.find(part => part.type === 'timeZoneName')?.value ?? ''
			);
		} catch {
			return '';
		}
	};

	const named = read('shortOffset') || read('short');

	// A name carrying digits ("GMT+3") or letters beyond GMT/UTC ("EDT") already identifies
	// the zone. A bare "GMT" does not, and Hermes returns exactly that for zones its ICU has
	// no abbreviation for — so the offset is measured off the wall clock instead.
	if (named && !/^(GMT|UTC)$/i.test(named)) {
		return named;
	}

	return `GMT${formatOffset(offsetMinutes(instant, timeZone))}`;
};

/** How far the zone's wall clock runs ahead of UTC at an instant, in minutes. */
const offsetMinutes = (instant: Date, timeZone: string): number => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(instant);
	const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value ?? 0);

	const asIfUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'));

	return Math.round((asIfUtc - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
};

const formatOffset = (minutes: number): string => {
	if (minutes === 0) {
		return '';
	}

	// ASCII hyphen, not a typographic minus: "GMT-4" is the conventional written form.
	const sign = minutes > 0 ? '+' : '-';
	const absolute = Math.abs(minutes);
	const hours = Math.floor(absolute / 60);
	const rest = absolute % 60;

	return rest === 0 ? `${sign}${hours}` : `${sign}${hours}:${String(rest).padStart(2, '0')}`;
};

/**
 * `roundDays`, not the cadence name.
 *
 * **Two different questions, and the cycle says which one is being asked.** A DAILY, WEEKLY
 * or MONTHLY group repeats, so the line is a rhythm: "Her çarşamba 00:00". A CUSTOM one does
 * not — "Özel" sets how long the hatim runs, after which it is finished — so the line is a
 * date: "22 Ekim 2026'da biter".
 *
 * This branched DAILY-or-else on the cadence alone, which was complete while the only two
 * values were DAILY and WEEKLY. Everything else fell into the *else*, so a fifteen-day
 * one-off announced itself as "Her çarşamba 00:00": a weekday it meets exactly once, and a
 * repetition that never comes.
 *
 * **A Hizb group's MONTHLY is a calendar month**, anchored on the start's day of the month, so
 * its line names that day ("Her ayın 31. günü"). A Cevşen or hatim MONTHLY is thirty days and
 * counts them like any other length — hence `kind`.
 */
export const roundResetLabels = (
	roundEndsAt: string | null,
	cycle: GroupCycle,
	roundDays: number,
	timezone: string,
	locale: string,
	t: (
		key:
			| 'resetDaily'
			| 'resetWeekly'
			| 'resetMonthly'
			| 'resetEveryNDays'
			| 'endsOn'
			| 'yourTimeAt'
			| 'yourTimeAtDay'
			| 'yourTimeAtDate',
		values: Record<string, string | number>
	) => string,
	kind: GroupKind,
	/**
	 * When the hatim began — a MONTHLY Hizb group rolls on this day of every month. Every group
	 * payload carries it, the invite preview included, and every screen passes it; without one
	 * the boundary's own day stands in (see the MONTHLY branch).
	 */
	startedAt: string | null = null
): RoundResetLabels | null => {
	if (!roundEndsAt) {
		return null;
	}

	const instant = new Date(roundEndsAt);

	if (Number.isNaN(instant.getTime())) {
		return null;
	}

	const zone = zoneAbbreviation(instant, locale, timezone);
	const groupTime = timeIn(instant, locale, timezone);
	const localTime = timeIn(instant, locale);

	/*
	 * A one-off states its end date, and nothing about a weekday or a zone: there is no next
	 * round for the reader to be early or late for, so the second line would have nothing to
	 * disambiguate.
	 */
	if (!isRepeatingCycle(cycle)) {
		return {
			group: t('endsOn', { date: dateIn(instant, locale, timezone) }),
			local: ''
		};
	}

	if (roundDays === 1) {
		return {
			group: t('resetDaily', { time: groupTime, zone }),
			local: t('yourTimeAt', { time: localTime })
		};
	}

	if (kind === 'HIZB' && cycle === 'MONTHLY') {
		/*
		 * **The start's day, not the boundary's.** The server rolls a month on the anchor's
		 * day-of-month, clamped — a group started on the 31st rolls on 28 February and then on
		 * 31 March — so the boundary's own day is only the rule in a month long enough to hold
		 * it. Without a start to read, it is the best answer there is, and right in most months.
		 */
		const start = startedAt ? new Date(startedAt) : null;
		const anchor = start && !Number.isNaN(start.getTime()) ? start : instant;

		return {
			group: t('resetMonthly', { day: dayOfMonthIn(anchor, timezone), time: groupTime, zone }),
			// Dated on the reader's side: crossing the zone can put the reset on the day before,
			// and a weekday alone would not say which month's.
			local: t('yourTimeAtDay', { day: dayAndMonthIn(instant, locale), time: localTime })
		};
	}

	if (roundDays === 7) {
		return {
			group: t('resetWeekly', { day: weekdayIn(instant, locale, timezone), time: groupTime, zone }),
			// The weekday is named on the reader's side too: crossing the zone can land the
			// reset on the day before, and "sende 18:00" alone would read as tonight.
			local: t('yourTimeAtDay', { day: weekdayIn(instant, locale), time: localTime })
		};
	}

	/*
	 * Any other repeating length — MONTHLY, or a future preset: **counted in days**, and no
	 * weekday, since only a seven-day round returns to the same one. It used to fall through
	 * to the daily wording, so a thirty-day hatim announced "Her gün 00:00". The reader's line
	 * names the next reset's date instead of a weekday, because "sende 00:00" alone reads as
	 * tonight.
	 */
	return {
		group: t('resetEveryNDays', { n: roundDays, time: groupTime, zone }),
		local: t('yourTimeAtDate', { date: shortDateIn(instant, locale), time: localTime })
	};
};

/** "26 Ağu" — the next reset's day in the reader's own zone, for a round with no weekday. */
const shortDateIn = (instant: Date, locale: string) =>
	new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(instant);

/** The date a one-off ends, written out in the group's own zone. */
const dateIn = (instant: Date, locale: string, timeZone: string) =>
	new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone, year: 'numeric' }).format(instant);

const CADENCE_CYCLE_KEYS = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', CUSTOM: 'qCustom' } as const;

/**
 * The Ritim row of a Hizb preview (HJ1/HJ2): the cycle, and the day it turns on —
 * "Haftalık · Pazartesi", "Aylık · ayın 1. günü", plain "Günlük".
 *
 * **The day is the start's, so a group that hasn't started has none.** A round boundary is
 * anchored on `startedAt`, which the owner stamps when they start the hatim — until then a
 * WEEKLY group has no weekday to name and a MONTHLY one no day of the month, and the row says
 * only the cycle rather than guess one. (`startsAt` is no stand-in: it is the creation time.)
 *
 * Both read in the group's zone, where its midnight falls. The weekday keeps `Intl`'s own
 * casing — it stands after a separator here, not mid-sentence as in `resetWeekly`, so Turkish
 * capitalises it and Dutch, correctly, does not.
 */
export const cadenceLabel = (
	cycle: GroupCycle,
	startedAt: string | null,
	timezone: string,
	locale: string,
	t: (key: 'daily' | 'weekly' | 'monthly' | 'qCustom' | 'cadenceMonthDay', values: Record<string, string>) => string
): string => {
	const cycleLabel = t(CADENCE_CYCLE_KEYS[cycle], {});
	const start = startedAt ? new Date(startedAt) : null;

	if (cycle === 'DAILY' || cycle === 'CUSTOM' || !start || Number.isNaN(start.getTime())) {
		return cycleLabel;
	}

	const day =
		cycle === 'WEEKLY'
			? new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: 'long' }).format(start)
			: t('cadenceMonthDay', { day: dayOfMonthIn(start, timezone) });

	return `${cycleLabel} · ${day}`;
};

/** Whole hours and minutes until the round rolls, for the DAILY screen's countdown. */
export const timeUntilReset = (roundEndsAt: string | null, now = new Date()): { hours: number; minutes: number } => {
	if (!roundEndsAt) {
		return { hours: 0, minutes: 0 };
	}

	const remaining = new Date(roundEndsAt).getTime() - now.getTime();

	if (!Number.isFinite(remaining) || remaining <= 0) {
		return { hours: 0, minutes: 0 };
	}

	return {
		hours: Math.floor(remaining / 3_600_000),
		minutes: Math.floor((remaining % 3_600_000) / 60_000)
	};
};

/**
 * How long the round has left, as one value — the group screen's summary card and the Hizb's
 * Havuz both say it, and said separately they came to disagree.
 *
 * Hours and minutes for a DAILY round, and for **any** round on its last day: the server floors
 * `daysLeft`, so a WEEKLY or MONTHLY round's final day arrives as 0, and "0 gün" reads as a round
 * already over. A count of days otherwise, with its own word for one — "1 day", not "1 days".
 * A null `daysLeft` is a legacy group whose `endsAt` was never backfilled, and gets an em dash.
 */
export const roundTimeLeftLabel = (
	{ cycle, daysLeft, hours, minutes }: { cycle: GroupCycle; daysLeft: number | null; hours: number; minutes: number },
	t: (key: 'dayCount' | 'dayCountOne' | 'hoursLeft', values?: Record<string, string | number>) => string
): string => {
	if (cycle === 'DAILY' || daysLeft === 0) {
		return t('hoursLeft', { hours, minutes });
	}

	if (daysLeft === null) {
		return '—';
	}

	return daysLeft === 1 ? t('dayCountOne') : t('dayCount', { count: daysLeft });
};

/**
 * When the first round would end, for QC3's "Tur bitişi" row — before any group exists.
 *
 * **Computed on the device, which is the one case where that is right.** Round maths is
 * server-only everywhere else: the client is handed a `roundIndex` and never derives one,
 * because the boundary belongs to the group's zone rather than the reader's. Here there is
 * no group yet and no zone but this one — the creator's device zone is what *becomes* the
 * group's, so the preview and the eventual stored value are measured against the same clock.
 *
 * **A round ends at the start of a civil day, so the date is the whole answer.** The frame
 * draws a time beside it ("30 Eyl · 21:30"), which is its mock status-bar clock rather than
 * a boundary: the reset is local midnight, and printing 21:30 would tell a reader their
 * round ends in the evening when it ends at the turn of the day. Adding days to the calendar
 * date rather than milliseconds to an instant is also what keeps a 23- or 25-hour DST day
 * counting as one day, exactly as `civilDayNumber` does on the server.
 */
export const roundEndPreview = (roundDays: number, locale: string): string => {
	const today = new Date();
	const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + Math.max(1, Math.floor(roundDays)));

	/*
	 * **Weekday, month and year — all three abbreviated.** Each part answers a different
	 * question: the weekday is what people plan around ("does this land on a Sunday?"), which
	 * a bare date makes you count out, and the year matters because a ninety-day round started
	 * in November ends in the next one, where "28 Oca" reads as a date already past.
	 *
	 * Spelled out, they do not fit. "Saturday, September 29, 2026" beside its label is wider
	 * than the row, so the line broke before the year and the last word landed on a line that
	 * is never drawn — a row ending in a comma. Two characters decided it: the same round at
	 * twelve days ("Sunday, October 4, 2026") fitted and showed the year, which made it look
	 * like a rule about cadence rather than about width. Abbreviated, every locale fits on one
	 * line and nothing is dropped.
	 *
	 * `Intl` orders and localises the whole thing, so there is no weekday table to keep in
	 * three languages and no format string that puts the weekday last in Turkish.
	 */
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		weekday: 'short',
		year: 'numeric'
	}).format(end);
};
