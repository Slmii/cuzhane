import type { StringKey } from '@/lib/i18n/strings';
import type { GroupKind } from '@/lib/types/domain';
import { BAB_COUNT } from '@/lib/utils/babs';

/**
 * The thirty cüz of a hatim. Mirrors `CUZ_COUNT` on the server, like `BAB_COUNT` beside it —
 * the two workspaces share no package, so the number is duplicated on purpose.
 */
export const CUZ_COUNT = 30;

/**
 * How many readable units a group is made of, by what it reads.
 *
 * **Read this wherever a group is in hand, never `BAB_COUNT`.** Every "N / 100" on a card,
 * a board or a progress line was that constant, and against a thirty-cüz group it is wrong
 * silently: the fraction simply stops at 30 / 100 and nothing says why. `BAB_COUNT` keeps
 * its place in the Cevşen's own machinery — the seat split, the reader's hundred — where the
 * number is the corpus rather than a group's configuration.
 */
export const unitCountFor = (kind: GroupKind): number => (kind === 'HATIM' ? CUZ_COUNT : BAB_COUNT);

/** What one unit is called: a bab, or a cüz. Plural and singular are the same word in all three. */
export const unitLabelKey = (kind: GroupKind): StringKey => (kind === 'HATIM' ? 'cuz' : 'babs');
