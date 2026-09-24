import { isRepeatingCycle, type GroupCycle } from '@/lib/types/domain';
/**
 * When a round rolls over, said twice: once in the group's day and once in the reader's.
 *
 * The boundary is a local midnight in the group's zone, so the group-side time is always
 * 00:00 — what varies is the zone it is midnight *in*, and which weekday a WEEKLY group
 * lands on. The reader-side line is the same instant expressed where they are standing,
 * which is the whole point: a Turkish group resetting at midnight is 18:00 the previous
 * day in New York, and without saying so the countdown looks wrong to everyone abroad.
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

const timeIn = (instant: Date, locale: string, timeZone?: string) =>
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
 * The zone's short name — "GMT+3" for Istanbul, "EDT" for New York. Read from the formatted
 * parts rather than hardcoded: the design's mock said "CEST" because its example group was
 * European, but the real abbreviation depends on the group and the season.
 *
 * `shortOffset` first because plain `short` collapses to a bare "GMT" on Hermes for zones
 * it has no abbreviation for, which is worse than useless — it names the wrong zone. Older
 * engines reject the option outright, hence the fallback.
 */
const zoneAbbreviation = (instant: Date, locale: string, timeZone: string): string => {
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
 */
export const roundResetLabels = (
	roundEndsAt: string | null,
	cycle: GroupCycle,
	roundDays: number,
	timezone: string,
	locale: string,
	t: (
		key: 'resetDaily' | 'resetWeekly' | 'endsOn' | 'yourTimeAt' | 'yourTimeAtDay',
		values: Record<string, string | number>
	) => string
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

	if (roundDays === 7) {
		return {
			group: t('resetWeekly', { day: weekdayIn(instant, locale, timezone), time: groupTime, zone }),
			// The weekday is named on the reader's side too: crossing the zone can land the
			// reset on the day before, and "sende 18:00" alone would read as tonight.
			local: t('yourTimeAtDay', { day: weekdayIn(instant, locale), time: localTime })
		};
	}

	/*
	 * Any other length: counted in days, and **no weekday on either side**. Only a seven-day
	 * round returns to the same weekday, so naming one here would describe this round rather
	 * than the rhythm — and the reader's line has no day to disambiguate for the same reason.
	 */
	/*
	 * A repeating length with no weekday to name — MONTHLY, or a future preset. Counted in
	 * days on both sides, because only a seven-day round returns to the same weekday.
	 */
	return {
		group: t('resetDaily', { time: groupTime, zone }),
		local: t('yourTimeAt', { time: localTime })
	};
};

/** The date a one-off ends, written out in the group's own zone. */
const dateIn = (instant: Date, locale: string, timeZone: string) =>
	new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone, year: 'numeric' }).format(instant);

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
