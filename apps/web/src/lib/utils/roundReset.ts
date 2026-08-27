import type { GroupCycle } from '@/lib/types/domain';

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

export const roundResetLabels = (
	roundEndsAt: string | null,
	cycle: GroupCycle,
	timezone: string,
	locale: string,
	t: (key: 'resetDaily' | 'resetWeekly' | 'yourTimeAt' | 'yourTimeAtDay', values: Record<string, string>) => string
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

	if (cycle === 'DAILY') {
		return {
			group: t('resetDaily', { time: groupTime, zone }),
			local: t('yourTimeAt', { time: localTime })
		};
	}

	return {
		group: t('resetWeekly', { day: weekdayIn(instant, locale, timezone), time: groupTime, zone }),
		// The weekday is named on the reader's side too: crossing the zone can land the reset
		// on the day before, and "sende 18:00" alone would read as tonight.
		local: t('yourTimeAtDay', { day: weekdayIn(instant, locale), time: localTime })
	};
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
