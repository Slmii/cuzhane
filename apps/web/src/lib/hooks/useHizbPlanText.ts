import type { HizbAssignment } from '@/api/hizbReading.api';
import { worksForParts } from '@/lib/content/hizbPortions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { formatBabRange } from '@/lib/utils/babs';
import { boardPortionsOf } from '@/lib/utils/hizbPlanBoard';
import { useCallback, useMemo } from 'react';

type Reading = Pick<HizbAssignment, 'planDays' | 'portion'>;

/** Every portion's own description, keyed by its number in the 33. */
const portionDescKey = (number: number) => `hizbPart${number}Desc` as StringKey;

/**
 * How the Hizb plan screens (the group screen and its T2–T5) write a reading — one set of words,
 * so "Bölüm 13 · Evrâd-ı Kudsiye" reads the same on every one of them.
 */
export const useHizbPlanText = () => {
	const { language, t } = useTranslation();

	/** Which of the 33 a reading covers: one on a 33-day plan, several on a 7- or 15-day one. */
	const portionsOf = useCallback((reading: Reading) => boardPortionsOf(reading.planDays, reading.portion), []);

	/** "13", or "8–13" for a longer day. */
	const portionsLabel = useCallback((reading: Reading) => formatBabRange(portionsOf(reading)), [portionsOf]);

	/** "Delâilü’n-Nûr", or "Evrâd-ı Kudsiye ve Delâilü’n-Nûr" when a day spans two works. */
	const workTitle = useCallback(
		(reading: Reading) => {
			const works = worksForParts(portionsOf(reading)).map(work => t(work.titleKey));

			return works.length > 1
				? `${works.slice(0, -1).join(', ')} ${t('listAnd')} ${works.at(-1) ?? ''}`
				: (works[0] ?? '');
		},
		[portionsOf, t]
	);

	/** One portion's own description ("Başından – …"); a longer day has none. */
	const portionDesc = useCallback(
		(reading: Reading) => {
			const numbers = portionsOf(reading);

			return numbers.length === 1 && numbers[0] !== undefined ? t(portionDescKey(numbers[0])) : null;
		},
		[portionsOf, t]
	);

	/**
	 * A group-local civil date ("2026-09-26") as "26 Eylül" or "26 Eyl" — formatted as that day
	 * whatever the device's zone.
	 */
	const monthDay = useCallback(
		(date: string, month: 'long' | 'short') =>
			new Date(`${date}T12:00:00Z`).toLocaleDateString(language, { day: 'numeric', month, timeZone: 'UTC' }),
		[language]
	);

	/** Turkish case endings ("Tur 3’te", "Eylül’ün"); the other languages carry the slot empty. */
	const trSuffix = useCallback((suffix: string) => (language === 'tr' ? suffix : ''), [language]);

	return useMemo(
		() => ({ monthDay, portionDesc, portionsLabel, portionsOf, trSuffix, workTitle }),
		[monthDay, portionDesc, portionsLabel, portionsOf, trSuffix, workTitle]
	);
};
