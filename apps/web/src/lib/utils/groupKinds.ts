import type { GroupCycle, GroupKind, GroupSplitMode } from '@/lib/types/domain';

/*
 * **Mirrored with `apps/server/src/utils/groupKinds.ts` — change both together.** The two
 * workspaces share no package, so `PART_COUNT`, the repetition table and `CYCLES_FOR_KIND` are
 * copied by hand, and `groupKinds.test.ts` holds this copy to the server's values. What follows
 * them (`SPOTS_FOR_KIND`, `CREATE_DEFAULTS_FOR_KIND`) is the create sheet's and client-only.
 */

/**
 * How many parts a group of each kind divides — the Cevşen's hundred babs, a hatim's thirty cüz
 * and the Hizb's 32 portions (the revised book division). `unitCountFor` reads this.
 */
export const PART_COUNT: Record<GroupKind, number> = { CEVSEN: 100, HATIM: 30, HIZB: 32 };

/** Parts a single reader must repeat before they count as read — Sekine, 19 times from its Besmele. */
const REQUIRED_REPETITIONS: Record<GroupKind, Readonly<Record<number, number>>> = {
	CEVSEN: {},
	HATIM: {},
	HIZB: { 19: 19 }
};

export const partCountFor = (kind: GroupKind) => PART_COUNT[kind];

export const requiredRepetitions = (kind: GroupKind, partNumber: number): number =>
	REQUIRED_REPETITIONS[kind][partNumber] ?? 1;

/**
 * Which cycles a kind may be created with. The Cevşen keeps its two; the Hizb adds a month. A
 * hatim is not given a cycle at all — QC3 asks for a round length (7, 30 or any number of days)
 * and the server derives the cycle from it, so any of the four can arrive.
 */
export const CYCLES_FOR_KIND: Record<GroupKind, readonly GroupCycle[]> = {
	CEVSEN: ['DAILY', 'WEEKLY'],
	HATIM: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
	HIZB: ['DAILY', 'WEEKLY', 'MONTHLY']
};

/**
 * A Şahsi (one person's) Cevşen or Kur'an reading splits the book over at most this many days: the
 * Cevşen over up to ninety, the Kur'an over up to thirty — a cüz a day at the slowest. The app
 * offers 10, 15 and 30 and lets the reader type any other length in range.
 */
export const PERSONAL_PLAN_MAX_DAYS = { CEVSEN: 90, HATIM: 30 } as const;

/**
 * A group read by day plans rather than on a shared board: a Hizb with a personal plan
 * (`hizbPlan`), or a Şahsi Cevşen/Kur'an reading (`planDays`). Neither has `GroupBab` rows.
 */
export const isPersonalPlan = (group: { hizbPlan: number | null; planDays: number | null }): boolean =>
	group.hizbPlan !== null || group.planDays !== null;

/**
 * The group sizes each kind may be created with, ascending — the list the create sheet's
 * stepper walks and the schema checks, so the two cannot disagree about what is selectable.
 *
 * The Cevşen offers three sizes that each divide the hundred evenly (20, 10 and 5 babs a head),
 * so nobody carries a leftover bab. The Hizb offers every size from one seat to one seat per
 * portion: 32 divides unevenly almost everywhere, the first `32 % spots` seats simply take one
 * more, and past 32 a seat would hold nothing. The server enforces the same two rules.
 *
 * A hatim offers no size: it is full when all thirty cüz are taken, not when thirty people have
 * joined, and the server pins its seat cap at the cüz count as a ceiling on membership.
 */
export const SPOTS_FOR_KIND: Record<GroupKind, readonly number[]> = {
	CEVSEN: [5, 10, 20],
	HATIM: [PART_COUNT.HATIM],
	HIZB: Array.from({ length: PART_COUNT.HIZB }, (_, index) => index + 1)
};

export type CreateGroupDefaults = { spots: number; cycle: GroupCycle; splitMode: GroupSplitMode };

/**
 * What the create sheet starts on for each kind. The Cevşen's are the sheet's long-standing
 * defaults; a Hizb group starts at one seat per portion, the whole book shared out; a hatim's
 * are what the server fills in for it (thirty seats, FIXED, and QC3's thirty-day round).
 */
export const CREATE_DEFAULTS_FOR_KIND: Record<GroupKind, CreateGroupDefaults> = {
	CEVSEN: { spots: 20, cycle: 'DAILY', splitMode: 'ROTATION' },
	HATIM: { spots: PART_COUNT.HATIM, cycle: 'MONTHLY', splitMode: 'FIXED' },
	HIZB: { spots: 32, cycle: 'DAILY', splitMode: 'ROTATION' }
};
