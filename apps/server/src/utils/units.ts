import { BAB_COUNT } from '@utils/babs';
import type { Group } from '../generated/prisma/client';

/**
 * How many readable units a group is made of, by what it reads.
 *
 * **The seam between the two reading types, and the smallest piece of it.** Everything the
 * app counts — a full board, a completed round, a progress denominator — was written as the
 * literal 100 or as `BAB_COUNT`, which is the same number wearing a name. Both are right for
 * a Cevşen group and wrong for a hatim, and the wrongness is silent: a thirty-cüz round
 * would simply never be "complete", and a percentage would top out at 30%.
 *
 * Read this instead of the constant wherever a *group* is in hand. `BAB_COUNT` keeps its
 * place in the Cevşen's own machinery — the seat split in `utils/babs.ts`, the reader's
 * hundred — where the number is the corpus rather than a group's configuration.
 */
export const CUZ_COUNT = 30;

export const unitCountFor = (group: Pick<Group, 'kind'>): number => (group.kind === 'HATIM' ? CUZ_COUNT : BAB_COUNT);
