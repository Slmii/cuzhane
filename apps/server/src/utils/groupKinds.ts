import type { CycleName } from '@utils/rounds';

/** What a group reads. Immutable after creation; a new division would be a new kind, never a re-read of this one. */
export type GroupKindName = 'CEVSEN' | 'HIZB';

/** How many parts a group of each kind divides among its seats. The Hizb's 33 is the revised book division. */
export const PART_COUNT: Record<GroupKindName, number> = { CEVSEN: 100, HIZB: 33 };

/** Parts a single reader must repeat before they count as read — Sekine, 19 times from its Besmele. */
const REQUIRED_REPETITIONS: Record<GroupKindName, Readonly<Record<number, number>>> = {
	CEVSEN: {},
	HIZB: { 19: 19 }
};

export const partCountFor = (kind: GroupKindName) => PART_COUNT[kind];

export const requiredRepetitions = (kind: GroupKindName, partNumber: number): number =>
	REQUIRED_REPETITIONS[kind][partNumber] ?? 1;

/** Which cycles a kind may be created with. The Cevşen keeps its two; the Hizb adds a month. */
export const CYCLES_FOR_KIND: Record<GroupKindName, readonly CycleName[]> = {
	CEVSEN: ['DAILY', 'WEEKLY'],
	HIZB: ['DAILY', 'WEEKLY', 'MONTHLY']
};
