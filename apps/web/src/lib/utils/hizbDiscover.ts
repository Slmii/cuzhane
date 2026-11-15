/** A year of days, after which a group's age reads in years ("2 yıldır"). */
const DAYS_PER_YEAR = 365;

/**
 * How long a Hizb group has been reading, for the Keşfet card and the invite preview: "Bugün
 * başladı" on its first day (drawn in the accent — there is no "Başlamadı" for a plan group),
 * then "41. gün", then whole years. `day` is the server's 1-based day in the group's own zone.
 */
export const hizbAgeLabel = (
	day: number,
	t: (key: 'hdStartedToday' | 'hdDayN' | 'hdYears', values?: Record<string, string | number>) => string
): { isNew: boolean; label: string } =>
	day <= 1
		? { isNew: true, label: t('hdStartedToday') }
		: day > DAYS_PER_YEAR
		? { isNew: false, label: t('hdYears', { n: Math.floor((day - 1) / DAYS_PER_YEAR) }) }
		: { isNew: false, label: t('hdDayN', { n: day }) };

/** "148", then "1,2 B" / "1.2K" from a thousand on — the language's own short form. */
export const compactCount = (count: number, language: string) =>
	count < 1000
		? String(count)
		: new Intl.NumberFormat(language, { maximumFractionDigits: 1, notation: 'compact' })
				.format(count)
				// Turkish separates the "B" with a no-break space; the card sets it as a plain one.
				.replace(/ /g, ' ');
