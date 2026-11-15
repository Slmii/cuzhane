import type { StringKey } from '../i18n/strings';
export const hizbPlanDescriptionKey = (days: number, portion: number): StringKey => {
	if (portion < 1 || portion > days || ![7, 15, 33].includes(days)) {
		throw new RangeError('Unknown Hizb portion');
	}
	return (days === 33 ? `hizbPart${portion}Desc` : `hp${days}_${portion}`) as StringKey;
};

/**
 * A plan's `YYYY-MM-DD` as a date in the reader's language — "14 Kasım", or "Cumartesi 14 Kasım".
 * Parsed at noon so no timezone can tip it onto the day before.
 */
export const formatPlanDate = (date: string, language: string, hasWeekday = false) =>
	new Date(`${date}T12:00:00`).toLocaleDateString(language, {
		day: 'numeric',
		month: 'long',
		...(hasWeekday ? { weekday: 'long' as const } : null)
	});
