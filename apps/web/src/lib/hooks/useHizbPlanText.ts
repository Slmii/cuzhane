import type { HizbAssignment } from '@/api/hizbReading.api';
import { worksForParts } from '@/lib/content/hizbPortions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import type { GroupKind } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { hizbPortionLabel } from '@/lib/utils/groups';
import { boardPortionsOf } from '@/lib/utils/hizbPlanBoard';
import { planUnitsOf } from '@/lib/utils/personalPlan';
import { useCallback, useMemo } from 'react';

type Reading = Pick<HizbAssignment, 'planDays' | 'portion'>;

/** Every portion's own description, keyed by its number in the 32. */
const portionDescKey = (number: number) => `hizbPart${number}Desc` as StringKey;

/**
 * How the plan screens (the group screen and its T2–T5) write a reading — one set of words,
 * so "Bölüm 13 · Evrâd-ı Kudsiye" reads the same on every one of them.
 *
 * `kind` is the Hizb's by default. A Şahsi Cevşen or Kur'an reading's day is a block of babs or
 * cüz, named by them ("Bab 41–50", "Cüz 3–4"); it has no work titles nor portion descriptions.
 */
export const useHizbPlanText = (kind: GroupKind = 'HIZB') => {
	const { language, t } = useTranslation();
	const isHizb = kind === 'HIZB';

	/**
	 * Which parts a reading covers: of the Hizb's 32, one on a 32-day plan and several on a 7- or
	 * 15-day one; of a Cevşen or Kur'an plan, the day's babs or cüz.
	 */
	const portionsOf = useCallback(
		(reading: Reading) =>
			kind === 'HIZB'
				? boardPortionsOf(reading.planDays, reading.portion)
				: planUnitsOf(kind, reading.planDays, reading.portion),
		[kind]
	);

	/** "13", or "8–13" for a longer day. */
	const portionsLabel = useCallback((reading: Reading) => formatBabRange(portionsOf(reading)), [portionsOf]);

	/** The parts with their noun: "Bölüm 8–13", "Bab 41–50", "Cüz 3–4". */
	const partsLabel = useCallback(
		(reading: Reading) =>
			kind === 'HIZB'
				? hizbPortionLabel(portionsLabel(reading), t)
				: t(kind === 'HATIM' ? 'homeCuzRange' : 'homeBabRange', { range: portionsLabel(reading) }),
		[kind, portionsLabel, t]
	);

	/** The plan's own day: "15 gün · 5. gün". */
	const dayLabel = useCallback(
		(reading: Reading) => t('hpPlanDay', { day: reading.portion, days: reading.planDays }),
		[t]
	);

	/**
	 * A reading's title: the Hizb's work — "Delâilü’n-Nûr", or "Evrâd-ı Kudsiye ve Delâilü’n-Nûr"
	 * when a day spans two works — and a Cevşen or Kur'an day's parts.
	 */
	const workTitle = useCallback(
		(reading: Reading) => {
			if (kind !== 'HIZB') {
				return partsLabel(reading);
			}

			const works = worksForParts(portionsOf(reading)).map(work => t(work.titleKey));

			return works.length > 1
				? `${works.slice(0, -1).join(', ')} ${t('listAnd')} ${works.at(-1) ?? ''}`
				: works[0] ?? '';
		},
		[kind, partsLabel, portionsOf, t]
	);

	/**
	 * What a row adds after a reading's parts — "Bölüm 13 · Evrâd-ı Kudsiye", "Bab 41–50 · 15 gün ·
	 * 5. gün" — the work for the Hizb, the plan's day for the others (whose title is their parts).
	 */
	const partsAside = useCallback(
		(reading: Reading) => (kind === 'HIZB' ? workTitle(reading) : dayLabel(reading)),
		[dayLabel, kind, workTitle]
	);

	/** One Hizb portion's own description ("Başından – …"); a longer day, and any other book, has none. */
	const portionDesc = useCallback(
		(reading: Reading) => {
			if (kind !== 'HIZB') {
				return null;
			}

			const numbers = portionsOf(reading);

			return numbers.length === 1 && numbers[0] !== undefined ? t(portionDescKey(numbers[0])) : null;
		},
		[kind, portionsOf, t]
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
		() => ({
			dayLabel,
			isHizb,
			monthDay,
			partsAside,
			partsLabel,
			portionDesc,
			portionsLabel,
			portionsOf,
			trSuffix,
			workTitle
		}),
		[
			dayLabel,
			isHizb,
			monthDay,
			partsAside,
			partsLabel,
			portionDesc,
			portionsLabel,
			portionsOf,
			trSuffix,
			workTitle
		]
	);
};
