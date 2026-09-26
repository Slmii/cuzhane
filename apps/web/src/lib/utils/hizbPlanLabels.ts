import type { StringKey } from '../i18n/strings';
export const hizbPlanDescriptionKey = (days: number, portion: number): StringKey => {
	if (portion < 1 || portion > days || ![7, 15, 33].includes(days)) {throw new RangeError('Unknown Hizb portion');}
	return (days === 33 ? `hizbPart${portion}Desc` : `hp${days}_${portion}`) as StringKey;
};
