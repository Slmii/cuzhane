import type { StringKey } from '@/lib/i18n/strings';
import type { AppNotification } from '@/lib/types/domain';
import { PART_COUNT } from '@/lib/utils/groupKinds';
import { isSinglePart } from '@/lib/utils/groups';

/**
 * The three buckets design P2 groups its list into.
 *
 * Bucketed in the **reader's** own days, like the profile's streak and heatmap and unlike a
 * group's rounds — an inbox is a personal record, so "Bugün" has to mean the reader's today
 * wherever their groups happen to roll.
 *
 * "Daha önce" is not in the design's two groups, which only draws Bugün and Bu hafta. It is here
 * because the server sends the last hundred rows and every one of them must land somewhere;
 * without it a fortnight-old notice would simply vanish from a list that claims to hold it.
 */
export type NotificationBucket = 'today' | 'week' | 'earlier';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which calendar day a moment falls on, as a number that can be subtracted.
 *
 * **Read the wall-clock date, then index it — never divide elapsed time by 24 hours.** A civil
 * day is 23 hours across a spring forward, so the difference between two local midnights floors
 * to zero and everything from *yesterday* was filed under "Bugün": in Amsterdam on 30 March
 * 2026, the whole of the 29th. The server hit the same wall and `utils/rounds.ts` solves it the
 * same way.
 *
 * `Date.UTC` over the **local** year/month/day is the trick, and it is not the UTC bucketing
 * CLAUDE.md warns against — that one reads `getUTCDate()`, which is a different date entirely
 * and put New York's reset at 20:00 the evening before. Here UTC is only an arithmetic frame
 * with no daylight saving in it; the date going in is the reader's own.
 */
const civilDayNumber = (value: Date) =>
	Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS);

export const bucketFor = (createdAt: string, now: Date): NotificationBucket => {
	const days = civilDayNumber(now) - civilDayNumber(new Date(createdAt));

	if (days <= 0) {
		return 'today';
	}

	return days < 7 ? 'week' : 'earlier';
};

export type NotificationGroup = { bucket: NotificationBucket; items: AppNotification[] };

/**
 * The list as the screen renders it: in order, grouped, and with empty buckets dropped.
 *
 * The rows arrive newest-first from the server and stay that way — a bucket with nothing in it
 * draws no heading, which is what keeps a quiet week from showing an empty "Bu hafta".
 */
export const groupNotifications = (rows: AppNotification[], now: Date): NotificationGroup[] => {
	const order: NotificationBucket[] = ['today', 'week', 'earlier'];

	return order
		.map(bucket => ({ bucket, items: rows.filter(row => bucketFor(row.createdAt, now) === bucket) }))
		.filter(group => group.items.length > 0);
};

/**
 * "12 dk", "1 s", "3 g" — the design's own compact relative time.
 *
 * Minutes up to an hour, hours up to a day, then days. It stops at days rather than becoming a
 * date because the list is already grouped by when, so the row only has to say how far into its
 * own bucket it sits.
 */
export const relativeAge = (createdAt: string, now: Date) => {
	const minutes = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000));

	if (minutes < 1) {
		return { count: 0, unit: 'now' as const };
	}

	if (minutes < 60) {
		return { count: minutes, unit: 'minutes' as const };
	}

	const hours = Math.floor(minutes / 60);

	return hours < 24
		? { count: hours, unit: 'hours' as const }
		: { count: Math.floor(hours / 24), unit: 'days' as const };
};

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

/**
 * An inbox row's two lines, composed from the strings table — the server sends data, not a
 * sentence, so a row reads in the language the reader is in now.
 *
 * **What the group reads picks the noun.** A Hizb group's rows name portions wherever the
 * Cevşen's name babs — a released claim, a finished share, a pool claim and a closed round — and
 * a range of one portion takes the singular, as the push it mirrors does. The member rows name
 * neither and read the same for both. A Cevşen row is composed exactly as it always was,
 * released range included: a Cevşen block is never a single bab.
 */
export const notificationText = (
	{ groupKind, kind, payload }: Pick<AppNotification, 'groupKind' | 'kind' | 'payload'>,
	t: Translate
): { title: string; body: string } => {
	const text = (name: string) => (typeof payload[name] === 'string' ? (payload[name] as string) : '');
	const count = (name: string) => (typeof payload[name] === 'number' ? (payload[name] as number) : 0);
	const isHizb = groupKind === 'HIZB';
	const range = text('range');
	const isOne = isSinglePart(range);

	switch (kind) {
		case 'POOL_CLAIM_RELEASED': {
			const startBab = count('startBab');
			const endBab = count('endBab');

			if (!isHizb) {
				return {
					body: t('notifPoolReleasedBody'),
					title: t('notifPoolReleasedTitle', { range: `${startBab}–${endBab}` })
				};
			}

			// A Hizb claim is released a portion at a time, so a run of one is the ordinary case: "27", not "27–27".
			const isSingle = startBab === endBab;

			return {
				body: t(isSingle ? 'notifPoolReleasedBodyHizbOne' : 'notifPoolReleasedBodyHizb'),
				title: t(isSingle ? 'notifPoolReleasedTitleHizbOne' : 'notifPoolReleasedTitleHizb', {
					range: isSingle ? `${startBab}` : `${startBab}–${endBab}`
				})
			};
		}
		case 'SHARE_READ':
			return {
				body: isHizb
					? t(isOne ? 'notifShareReadBodyHizbOne' : 'notifShareReadBodyHizb', { range })
					: t('notifShareReadBody', { range }),
				title: t('notifShareReadTitle', { name: text('readerName') })
			};
		case 'ROUND_COMPLETE':
			return {
				body: isHizb
					? t('notifRoundCompleteBodyHizb', { count: PART_COUNT.HIZB })
					: t('notifRoundCompleteBody'),
				title: t('notifRoundCompleteTitle', { round: count('roundNumber') })
			};
		case 'POOL_BAB_CLAIMED': {
			const name = text('takerName');

			return isHizb
				? {
						body: t(isOne ? 'notifPoolClaimedBodyHizbOne' : 'notifPoolClaimedBodyHizb', { range }),
						title: t(isOne ? 'notifPoolClaimedTitleHizbOne' : 'notifPoolClaimedTitleHizb', { name })
				  }
				: { body: t('notifPoolClaimedBody', { range }), title: t('notifPoolClaimedTitle', { name }) };
		}
		case 'MEMBER_JOINED':
			return {
				body: t('notifMemberJoinedBody', { count: count('memberCount'), spots: count('spots') }),
				title: t('notifMemberJoinedTitle', { name: text('memberName') })
			};
		case 'MEMBER_LEFT':
			return {
				body: t('notifMemberLeftBody', { count: count('memberCount'), spots: count('spots') }),
				title: t('notifMemberLeftTitle', { name: text('memberName') })
			};
	}
};
