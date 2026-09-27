import { describe, expect, it } from 'vitest';
import { bucketFor, groupNotifications, relativeAge } from './notifications';
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
