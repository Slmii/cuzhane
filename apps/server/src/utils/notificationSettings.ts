import type { GroupKind, Prisma } from '../generated/prisma/client';

/**
 * Which `UserSettings` column governs a notification, given what the group reads.
 *
 * **Three of the events are per reading type**, because they are not the same news: "someone
 * finished their share" is a range of babs in one group and a cüz in another, a round closing
 * is a hundred babs or thirty cüz, and the pool holds different things. A reader in both kinds
 * gets to choose separately, which is what P4's Kuran and Cevşen sections are.
 *
 * **A Hizb group has its own group-reads switch**, and answers to the Cevşen's for the rest: a
 * shared board runs on the Cevşen's model (seats, blocks, a pool of portions), and those are the
 * columns its pool and round notices were written against. Responsible members of a Hizb plan
 * hear its reads whatever their switch says — see `notifyHizbRead`.
 *
 * Member joined/left are deliberately **not** here: who is in a group is the same event
 * whatever it reads, and they stay on one switch in "Genel".
 *
 * Typed against `Prisma.UserSettingsWhereInput` for the same reason `GroupEventSetting` is —
 * these names end up in a computed `where` key, which TypeScript cannot otherwise check, and a
 * stale generated client would compile clean and throw `Unknown argument` at runtime.
 */
type PerKindSetting = Extract<
	keyof Prisma.UserSettingsWhereInput,
	| 'cevsenGroupReadsEnabled'
	| 'cevsenPoolClaimEnabled'
	| 'cevsenRoundCompleteEnabled'
	| 'hatimGroupReadsEnabled'
	| 'hatimPoolClaimEnabled'
	| 'hatimRoundCompleteEnabled'
	| 'hizbGroupReadsEnabled'
>;

/**
 * `as const` so each entry keeps its literal type. Without it every lookup widens to the whole
 * union, and `notifyGroupMembers` — whose own `setting` type admits only the two pool columns —
 * would be handed "one of six" and refuse it.
 */
const BY_EVENT = {
	groupReads: { CEVSEN: 'cevsenGroupReadsEnabled', HATIM: 'hatimGroupReadsEnabled', HIZB: 'hizbGroupReadsEnabled' },
	poolClaim: { CEVSEN: 'cevsenPoolClaimEnabled', HATIM: 'hatimPoolClaimEnabled', HIZB: 'cevsenPoolClaimEnabled' },
	roundComplete: {
		CEVSEN: 'cevsenRoundCompleteEnabled',
		HATIM: 'hatimRoundCompleteEnabled',
		HIZB: 'cevsenRoundCompleteEnabled'
	}
} as const satisfies Record<string, Record<GroupKind, PerKindSetting>>;

/** `settingFor('groupReads', group.kind)` — the only place a kind picks a column. */
export const settingFor = <Event extends keyof typeof BY_EVENT, Kind extends GroupKind>(
	event: Event,
	kind: Kind
): (typeof BY_EVENT)[Event][Kind] => BY_EVENT[event][kind];
