import type { GroupCycle, GroupKind, GroupSplitMode } from '@/lib/types/domain';

/*
 * **Mirrored with `apps/server/src/utils/groupKinds.ts` — change both together.** The two
 * workspaces share no package, so `PART_COUNT`, the repetition table and `CYCLES_FOR_KIND` are
 * copied by hand, and `groupKinds.test.ts` holds this copy to the server's values. What follows
 * them (`SPOTS_FOR_KIND`, `CREATE_DEFAULTS_FOR_KIND`) is the create sheet's and client-only.
 */

/** How many parts a group of each kind divides among its seats. The Hizb's 33 is the revised book division. */
export const PART_COUNT: Record<GroupKind, number> = { CEVSEN: 100, HIZB: 33 };

/** Parts a single reader must repeat before they count as read — Sekine, 19 times from its Besmele. */
const REQUIRED_REPETITIONS: Record<GroupKind, Readonly<Record<number, number>>> = {
	CEVSEN: {},
	HIZB: { 19: 19 }
};

export const partCountFor = (kind: GroupKind) => PART_COUNT[kind];

export const requiredRepetitions = (kind: GroupKind, partNumber: number): number =>
	REQUIRED_REPETITIONS[kind][partNumber] ?? 1;

/** Which cycles a kind may be created with. The Cevşen keeps its two; the Hizb adds a month. */
export const CYCLES_FOR_KIND: Record<GroupKind, readonly GroupCycle[]> = {
	CEVSEN: ['DAILY', 'WEEKLY'],
	HIZB: ['DAILY', 'WEEKLY', 'MONTHLY']
};

/**
 * The group sizes each kind may be created with, ascending — the list the create sheet's
 * stepper walks and the schema checks, so the two cannot disagree about what is selectable.
 *
 * The Cevşen offers three sizes that each divide the hundred evenly (20, 10 and 5 babs a head),
 * so nobody carries a leftover bab. The Hizb offers every size from one seat to one seat per
 * portion: 33 divides unevenly almost everywhere, the first `33 % spots` seats simply take one
 * more, and past 33 a seat would hold nothing. The server enforces the same two rules.
 */
export const SPOTS_FOR_KIND: Record<GroupKind, readonly number[]> = {
	CEVSEN: [5, 10, 20],
	HIZB: Array.from({ length: PART_COUNT.HIZB }, (_, index) => index + 1)
};

export type CreateGroupDefaults = { spots: number; cycle: GroupCycle; splitMode: GroupSplitMode };

/**
 * What the create sheet starts on for each kind. The Cevşen's are the sheet's long-standing
 * defaults; a Hizb group starts at one seat per portion, the whole book shared out.
 */
export const CREATE_DEFAULTS_FOR_KIND: Record<GroupKind, CreateGroupDefaults> = {
	CEVSEN: { spots: 20, cycle: 'DAILY', splitMode: 'ROTATION' },
	HIZB: { spots: 33, cycle: 'DAILY', splitMode: 'ROTATION' }
};
