import type { CycleName } from '@utils/rounds';
import { PART_COUNT } from '@utils/units';

export { PART_COUNT };

/** What a group reads. Immutable after creation; a new division would be a new kind, never a re-read of this one. */
export type GroupKindName = 'CEVSEN' | 'HATIM' | 'HIZB';

/** How many parts a group of each kind divides. The same table `unitCountFor` reads. */
export const partCountFor = (kind: GroupKindName): number => PART_COUNT[kind];

/** Parts a single reader must repeat before they count as read — Sekine, 19 times from its Besmele. */
const REQUIRED_REPETITIONS: Record<GroupKindName, Readonly<Record<number, number>>> = {
	CEVSEN: {},
	HATIM: {},
	HIZB: { 19: 19 }
};

export const requiredRepetitions = (kind: GroupKindName, partNumber: number): number =>
	REQUIRED_REPETITIONS[kind][partNumber] ?? 1;

/**
 * Which cycles a kind may carry. The Cevşen keeps its two; the Hizb adds a (calendar) month.
 * A Kur'an group is never *asked* for a cycle — it picks a length in days and the label is
 * derived from it (`planColumnsFor` in `groups.service`), so any of the four can result.
 */
export const CYCLES_FOR_KIND: Record<GroupKindName, readonly CycleName[]> = {
	CEVSEN: ['DAILY', 'WEEKLY'],
	HATIM: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
	HIZB: ['DAILY', 'WEEKLY', 'MONTHLY']
};
