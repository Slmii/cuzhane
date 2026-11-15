import { describe, expect, it } from 'vitest';
import { bucketFor, groupNotifications, notificationText, relativeAge } from './notifications';
import type { AppNotification } from '@/lib/types/domain';

const at = (year: number, month: number, day: number, hour = 12) => new Date(year, month, day, hour);

describe('bucketFor', () => {
	it('puts today in today, whatever the hour', () => {
		expect(bucketFor(at(2026, 5, 10, 0).toISOString(), at(2026, 5, 10, 23))).toBe('today');
	});

	it('puts yesterday in this week', () => {
		expect(bucketFor(at(2026, 5, 9).toISOString(), at(2026, 5, 10))).toBe('week');
	});

	it('puts a week and a day ago in earlier', () => {
		expect(bucketFor(at(2026, 5, 1).toISOString(), at(2026, 5, 9))).toBe('earlier');
	});

	/*
	 * The bug this replaced divided the gap between two local midnights by a flat 24 hours. A
	 * civil day is 23 hours across a spring forward, so the whole of the previous day floored to
	 * zero and was filed under "Bugün". These dates are the 2026 transitions.
	 */
	it('does not call yesterday today across a spring forward', () => {
		// Europe/Amsterdam and Europe/Istanbul move on 29 March 2026; the US on 8 March.
		expect(bucketFor(at(2026, 2, 29).toISOString(), at(2026, 2, 30))).toBe('week');
		expect(bucketFor(at(2026, 2, 8).toISOString(), at(2026, 2, 9))).toBe('week');
	});

	it('does not call yesterday the week before last across an autumn back', () => {
		expect(bucketFor(at(2026, 9, 25).toISOString(), at(2026, 9, 26))).toBe('week');
		expect(bucketFor(at(2026, 10, 1).toISOString(), at(2026, 10, 2))).toBe('week');
	});
});

const row = (id: string, createdAt: Date): AppNotification => ({
	id,
	kind: 'ROUND_COMPLETE',
	groupId: 'g1',
	groupName: 'Şifa Hatmi',
	groupKind: 'CEVSEN',
	payload: { roundNumber: 3 },
	isRead: false,
	createdAt: createdAt.toISOString()
});

describe('groupNotifications', () => {
	it('drops empty buckets so a quiet week draws no heading', () => {
		const now = at(2026, 5, 10);
		const groups = groupNotifications([row('a', at(2026, 5, 10, 9)), row('b', at(2026, 4, 20))], now);

		expect(groups.map(group => group.bucket)).toEqual(['today', 'earlier']);
	});

	it('keeps the newest-first order inside a bucket', () => {
		const now = at(2026, 5, 10);
		const groups = groupNotifications([row('a', at(2026, 5, 10, 11)), row('b', at(2026, 5, 10, 9))], now);

		expect(groups[0]?.items.map(item => item.id)).toEqual(['a', 'b']);
	});
});

describe('relativeAge', () => {
	it('stops at days, because the list is already grouped by when', () => {
		const now = at(2026, 5, 10, 12);

		const twelveMinutesAgo = new Date(now.getTime() - 12 * 60_000);

		expect(relativeAge(twelveMinutesAgo.toISOString(), now)).toEqual({ count: 12, unit: 'minutes' });
		expect(relativeAge(at(2026, 5, 10, 9).toISOString(), now)).toEqual({ count: 3, unit: 'hours' });
		expect(relativeAge(at(2026, 5, 7, 12).toISOString(), now)).toEqual({ count: 3, unit: 'days' });
	});

	it('reads a moment ago as now rather than zero minutes', () => {
		const now = at(2026, 5, 10, 12);

		expect(relativeAge(new Date(now.getTime() - 5_000).toISOString(), now)).toEqual({ count: 0, unit: 'now' });
	});
});

describe('notificationText', () => {
	// The key with its values, so a test asserts on the line chosen rather than on its Turkish.
	const t = (key: string, values?: Record<string, string | number>) =>
		values === undefined
			? key
			: `${key}(${Object.entries(values)
					.map(([name, value]) => `${name}=${value}`)
					.join(',')})`;

	const row = (
		kind: AppNotification['kind'],
		payload: Record<string, unknown>,
		groupKind: AppNotification['groupKind'] = 'CEVSEN'
	) => ({ groupKind, kind, payload });

	it('composes a Cevşen row exactly as before', () => {
		expect(notificationText(row('SHARE_READ', { range: '1–13', readerName: 'Ali' }), t)).toEqual({
			body: 'notifShareReadBody(range=1–13)',
			title: 'notifShareReadTitle(name=Ali)'
		});
		expect(notificationText(row('POOL_CLAIM_RELEASED', { endBab: 20, startBab: 16 }), t)).toEqual({
			body: 'notifPoolReleasedBody',
			title: 'notifPoolReleasedTitle(range=16–20)'
		});
		expect(notificationText(row('ROUND_COMPLETE', { roundNumber: 4 }), t).body).toBe('notifRoundCompleteBody');
		expect(notificationText(row('POOL_BAB_CLAIMED', { range: '41–50', takerName: 'Hilal' }), t)).toEqual({
			body: 'notifPoolClaimedBody(range=41–50)',
			title: 'notifPoolClaimedTitle(name=Hilal)'
		});
	});

	it('speaks in cüz for a hatim, and counts people rather than seats (Q8)', () => {
		expect(notificationText(row('SHARE_READ', { range: '29', readerName: 'Ayşe' }, 'HATIM'), t)).toEqual({
			body: 'notifCuzReadBody',
			title: 'notifCuzTitle(name=Ayşe,range=29)'
		});
		expect(notificationText(row('ROUND_COMPLETE', { roundNumber: 3 }, 'HATIM'), t)).toEqual({
			body: 'notifHatimDoneBody(count=30,round=3)',
			title: 'notifHatimDoneTitle'
		});
		expect(notificationText(row('MEMBER_JOINED', { memberCount: 4, memberName: 'Ali' }, 'HATIM'), t).body).toBe(
			'notifMembersBody(count=4)'
		);
	});

	it('reads a row whose group is gone as Cevşen', () => {
		expect(notificationText(row('ROUND_COMPLETE', { roundNumber: 4 }, null), t).body).toBe(
			'notifRoundCompleteBody'
		);
	});

	it('names portions and their works in a Hizb group, singular for a range of one', () => {
		expect(notificationText(row('SHARE_READ', { range: '15–16', readerName: 'Ali' }, 'HIZB'), t).body).toBe(
			'notifShareReadBodyHizbWorks(range=15–16,works=hizbWorkDelail)'
		);
		expect(notificationText(row('SHARE_READ', { range: '19', readerName: 'Ali' }, 'HIZB'), t).body).toBe(
			'notifShareReadBodyHizbWorksOne(range=19,works=hizbWorkSekine)'
		);
		// A day across two works names both, in reading order.
		expect(notificationText(row('SHARE_READ', { range: '12–14', readerName: 'Ali' }, 'HIZB'), t).body).toBe(
			'notifShareReadBodyHizbWorks(range=12–14,works=hizbWorkEvrad, hizbWorkDelail)'
		);
		// A range it cannot read still says the portions.
		expect(notificationText(row('SHARE_READ', { range: '', readerName: 'Ali' }, 'HIZB'), t).body).toBe(
			'notifShareReadBodyHizbOne(range=)'
		);
		// A notice kept from the 33-portion division names a portion that no longer exists.
		expect(notificationText(row('SHARE_READ', { range: '31–33', readerName: 'Ali' }, 'HIZB'), t).body).toBe(
			'notifShareReadBodyHizbWorks(range=31–33,works=hizbWorkTazarru)'
		);
	});

	it('writes a released Hizb portion as one number, not a span of one', () => {
		expect(notificationText(row('POOL_CLAIM_RELEASED', { endBab: 27, startBab: 27 }, 'HIZB'), t)).toEqual({
			body: 'notifPoolReleasedBodyHizbOne',
			title: 'notifPoolReleasedTitleHizbOne(range=27)'
		});
		expect(notificationText(row('POOL_CLAIM_RELEASED', { endBab: 16, startBab: 15 }, 'HIZB'), t).title).toBe(
			'notifPoolReleasedTitleHizb(range=15–16)'
		);
	});

	it('names portions on a Hizb pool claim, title and body', () => {
		expect(notificationText(row('POOL_BAB_CLAIMED', { range: '24', takerName: 'Hilal' }, 'HIZB'), t)).toEqual({
			body: 'notifPoolClaimedBodyHizbOne(range=24)',
			title: 'notifPoolClaimedTitleHizbOne(name=Hilal)'
		});
		expect(notificationText(row('POOL_BAB_CLAIMED', { range: '5, 31', takerName: 'Hilal' }, 'HIZB'), t).body).toBe(
			'notifPoolClaimedBodyHizb(range=5, 31)'
		);
	});

	it('counts the Hizb’s own portions when a round closes', () => {
		expect(notificationText(row('ROUND_COMPLETE', { roundNumber: 2 }, 'HIZB'), t)).toEqual({
			body: 'notifRoundCompleteBodyHizb(count=32)',
			title: 'notifRoundCompleteTitle(round=2)'
		});
	});

	it('reads a member row the same for either book, since it names no part', () => {
		const payload = { memberCount: 4, memberName: 'Zeynep', spots: 12 };

		expect(notificationText(row('MEMBER_LEFT', payload, 'HIZB'), t)).toEqual(
			notificationText(row('MEMBER_LEFT', payload), t)
		);
		expect(notificationText(row('MEMBER_JOINED', payload, 'HIZB'), t).body).toBe(
			'notifMemberJoinedBody(count=4,spots=12)'
		);
	});

	it('survives a payload missing its fields', () => {
		expect(notificationText(row('SHARE_READ', {}, 'HIZB'), t).title).toBe('notifShareReadTitle(name=)');
	});
});
