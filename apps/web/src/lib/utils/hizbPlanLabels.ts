import type { StringKey } from '../i18n/strings';
export const hizbPlanDescriptionKey = (days: number, portion: number): StringKey => {
	if (portion < 1 || portion > days || ![7, 15, 32].includes(days)) {
		throw new RangeError('Unknown Hizb portion');
	}
	return (days === 32 ? `hizbPart${portion}Desc` : `hp${days}_${portion}`) as StringKey;
};

/** A plan's ISO date (`YYYY-MM-DD`) in the reader's language — noon, so no zone tips it into another day. */
export const formatPlanDate = (date: string, language: string, hasWeekday = false) =>
	new Date(`${date}T12:00:00`).toLocaleDateString(language, {
		day: 'numeric',
		month: 'long',
		...(hasWeekday ? { weekday: 'long' as const } : null)
	});
