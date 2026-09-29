import type { StringKey } from '@/lib/i18n/strings';
import type { GroupKind } from '@/lib/types/domain';
import { PART_COUNT, partCountFor } from '@/lib/utils/groupKinds';

/**
 * The thirty cüz of a hatim. Mirrors `CUZ_COUNT` on the server, like `BAB_COUNT` beside it —
 * the two workspaces share no package, so the number is duplicated on purpose. The same value
 * as `PART_COUNT.HATIM`, which is where it is defined.
 */
export const CUZ_COUNT = PART_COUNT.HATIM;

/**
 * How many readable units a group is made of, by what it reads — 100 babs, 30 cüz or 33
 * portions. One table (`PART_COUNT` in `groupKinds.ts`) answers it for every kind.
 *
 * **Read this wherever a group is in hand, never `BAB_COUNT`.** Every "N / 100" on a card,
 * a board or a progress line was that constant, and against a thirty-cüz group it is wrong
 * silently: the fraction simply stops at 30 / 100 and nothing says why. `BAB_COUNT` keeps
 * its place in the Cevşen's own machinery — the seat split, the reader's hundred — where the
 * number is the corpus rather than a group's configuration.
 */
export const unitCountFor = (kind: GroupKind): number => partCountFor(kind);

// A record, so a kind added to `GroupKind` fails the build until its unit has a name.
const UNIT_LABEL_KEYS: Record<GroupKind, StringKey> = { CEVSEN: 'babs', HATIM: 'cuz', HIZB: 'portions' };

/** What one unit is called: a bab, a cüz or a portion. Lowercase, for after a number. */
export const unitLabelKey = (kind: GroupKind): StringKey => UNIT_LABEL_KEYS[kind];
