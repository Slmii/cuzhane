import { BAB_COUNT } from '@utils/babs';
import type { Group } from '../generated/prisma/client';

/**
 * How many readable units a group is made of, by what it reads.
 *
 * **The seam between the reading types, and the smallest piece of it.** Everything the
 * app counts — a full board, a completed round, a progress denominator — was written as the
 * literal 100 or as `BAB_COUNT`, which is the same number wearing a name. Both are right for
 * a Cevşen group and wrong for a hatim or a Hizb group, and the wrongness is silent: a
 * thirty-cüz round would simply never be "complete", and a percentage would top out at 30%.
 *
 * Read this instead of the constant wherever a *group* is in hand. `BAB_COUNT` keeps its
 * place in the Cevşen's own machinery — the reader's hundred — where the number is the
 * corpus rather than a group's configuration.
 */
export const CUZ_COUNT = 30;

/** The Hizbü'l-Hakaik's portions — the revised book division. */
export const HIZB_PORTION_COUNT = 32;

/**
 * Units per kind: the Cevşen's 100 babs, the Kur'an's 30 cüz, the Hizb's 32 portions. The one
 * table every count reads — `partCountFor` in `utils/groupKinds` is this, by kind.
 */
export const PART_COUNT = { CEVSEN: BAB_COUNT, HATIM: CUZ_COUNT, HIZB: HIZB_PORTION_COUNT } as const satisfies Record<
	Group['kind'],
	number
>;

export const unitCountFor = (group: Pick<Group, 'kind'>): number => PART_COUNT[group.kind];
