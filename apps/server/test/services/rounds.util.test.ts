import { rangeForRound } from '@utils/babs';
import { civilDayNumber, roundEndsAt, roundIndexSince, roundStartedAtFor, startOfCivilDay } from '@utils/rounds';
import { describe, expect, it } from 'vitest';

const DAILY = 1;
const WEEKLY = 7;

const UTC = 'UTC';
const ISTANBUL = 'Europe/Istanbul';
const NEW_YORK = 'America/New_York';

describe('roundIndexSince', () => {
	it('is 0 during the round the hatim started in, whatever the hour', () => {
		const startedAt = new Date('2026-08-26T21:30:00Z');
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-26T21:31:00Z'), UTC)).toBe(0);
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-26T23:59:00Z'), UTC)).toBe(0);
	});

	it('rolls a DAILY group at midnight rather than 24h after the start', () => {
		const startedAt = new Date('2026-08-26T21:30:00Z');
		// Only 2.5 hours later, but it is the next calendar day.
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-27T00:01:00Z'), UTC)).toBe(1);
	});

	it('holds a WEEKLY group on one round for seven days', () => {
		const startedAt = new Date('2026-08-26T10:00:00Z');
		expect(roundIndexSince(startedAt, WEEKLY, new Date('2026-08-27T10:00:00Z'), UTC)).toBe(0);
		expect(roundIndexSince(startedAt, WEEKLY, new Date('2026-09-01T23:00:00Z'), UTC)).toBe(0);
		expect(roundIndexSince(startedAt, WEEKLY, new Date('2026-09-02T00:01:00Z'), UTC)).toBe(1);
		expect(roundIndexSince(startedAt, WEEKLY, new Date('2026-09-09T00:01:00Z'), UTC)).toBe(2);
	});

	it('never goes negative for a clock behind the start', () => {
		const startedAt = new Date('2026-08-26T10:00:00Z');
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-20T10:00:00Z'), UTC)).toBe(0);
	});
});

describe('roundStartedAtFor', () => {
	it('returns the hatim start for round 0, which begins when the owner tapped', () => {
		const startedAt = new Date('2026-08-26T10:00:00Z');
		expect(roundStartedAtFor(startedAt, DAILY, 0, UTC)).toEqual(startedAt);
		expect(roundStartedAtFor(startedAt, WEEKLY, 0, UTC)).toEqual(startedAt);
	});

	it('starts later rounds at midnight, where the boundary actually falls', () => {
		const startedAt = new Date('2026-08-26T10:00:00Z');
		expect(roundStartedAtFor(startedAt, DAILY, 3, UTC)).toEqual(new Date('2026-08-29T00:00:00Z'));
		expect(roundStartedAtFor(startedAt, WEEKLY, 2, UTC)).toEqual(new Date('2026-09-09T00:00:00Z'));
	});

	it('agrees with roundIndexSince for a group started just before midnight', () => {
		const startedAt = new Date('2026-08-26T23:50:00Z');
		const justAfterMidnight = new Date('2026-08-27T00:05:00Z');

		expect(roundIndexSince(startedAt, DAILY, justAfterMidnight, UTC)).toBe(1);
		expect(roundStartedAtFor(startedAt, DAILY, 1, UTC)).toEqual(new Date('2026-08-27T00:00:00Z'));
		expect(roundStartedAtFor(startedAt, DAILY, 1, UTC).getTime()).toBeLessThanOrEqual(justAfterMidnight.getTime());
	});

	it('holds a WEEKLY seat on one range all week, then moves it on', () => {
		const startedAt = new Date('2026-08-26T10:00:00Z');
		const rangeOn = (now: string) => rangeForRound(0, 20, roundIndexSince(startedAt, WEEKLY, new Date(now), UTC));

		// Week 1 — the range does not budge from day to day.
		expect(rangeOn('2026-08-26T10:00:00Z')).toEqual({ start: 1, end: 5 });
		expect(rangeOn('2026-08-29T10:00:00Z')).toEqual({ start: 1, end: 5 });
		expect(rangeOn('2026-09-01T23:00:00Z')).toEqual({ start: 1, end: 5 });
		// Week 2 — one seat forward.
		expect(rangeOn('2026-09-02T00:01:00Z')).toEqual({ start: 6, end: 10 });
	});
});

describe('time zones', () => {
	it('rolls an Istanbul group at Istanbul midnight, three hours before UTC midnight', () => {
		const startedAt = new Date('2026-08-26T10:00:00Z');

		// 23:59 in Istanbul — still the same local day, though UTC calls it 20:59.
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-26T20:59:00Z'), ISTANBUL)).toBe(0);
		// 00:01 in Istanbul the next day, while UTC is still on the 26th.
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-26T21:01:00Z'), ISTANBUL)).toBe(1);
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-26T21:01:00Z'), UTC)).toBe(0);
	});

	it('does not wipe a New York board mid-evening, which UTC bucketing did', () => {
		const startedAt = new Date('2026-08-26T14:00:00Z');

		// 21:00 on the 26th in New York. Under UTC this instant is already the 27th, so the
		// board used to reset while the member's evening was still going.
		const mondayEvening = new Date('2026-08-27T01:00:00Z');
		expect(roundIndexSince(startedAt, DAILY, mondayEvening, NEW_YORK)).toBe(0);
		expect(roundIndexSince(startedAt, DAILY, mondayEvening, UTC)).toBe(1);

		// 00:01 local really is the next day.
		expect(roundIndexSince(startedAt, DAILY, new Date('2026-08-27T04:01:00Z'), NEW_YORK)).toBe(1);
	});

	it('anchors a later round to local midnight, not UTC midnight', () => {
		const startedAt = new Date('2026-08-26T10:00:00Z');

		// Midnight in Istanbul is 21:00Z the evening before.
		expect(roundStartedAtFor(startedAt, DAILY, 1, ISTANBUL)).toEqual(new Date('2026-08-26T21:00:00Z'));
	});

	it('counts a 23-hour spring-forward day as one day', () => {
		// US DST begins 2027-03-14. Noon-to-noon across it is 23 hours, not 24 — measured in
		// hours this would round down to zero days and the group would fail to roll.
		const beforeTransition = new Date('2027-03-13T17:00:00Z'); // 12:00 EST
		const afterTransition = new Date('2027-03-14T16:00:00Z'); // 12:00 EDT

		expect(afterTransition.getTime() - beforeTransition.getTime()).toBe(23 * 60 * 60 * 1000);
		expect(roundIndexSince(beforeTransition, DAILY, afterTransition, NEW_YORK)).toBe(1);
	});

	it('lands on a real local midnight on the day the clocks change', () => {
		const startedAt = new Date('2027-03-13T17:00:00Z');

		// The 14th begins at 00:00 EST (05:00Z) — the transition itself is not until 02:00.
		expect(roundStartedAtFor(startedAt, DAILY, 1, NEW_YORK)).toEqual(new Date('2027-03-14T05:00:00Z'));
	});

	it('makes a week seven local days, not 168 hours', () => {
		// The week containing the spring-forward is 167 hours long. Measuring it in hours
		// would end it an hour late, and drift further at every DST change after that.
		const roundStart = new Date('2027-03-14T18:00:00Z'); // 2027-03-14 14:00 EDT
		const ends = roundEndsAt(roundStart, 'WEEKLY', NEW_YORK);

		expect(ends).toEqual(new Date('2027-03-21T04:00:00Z')); // 2027-03-21 00:00 EDT
		expect(ends.getTime() - startOfCivilDay(civilDayNumber(roundStart, NEW_YORK), NEW_YORK).getTime()).toBe(
			167 * 60 * 60 * 1000
		);
	});

	it('starts the day at 01:00 where local midnight never happened', () => {
		// Havana springs forward AT midnight: 2020-03-08 00:00 does not exist, the day begins
		// at 01:00. Naive offset correction lands on 23:00 the night before — the wrong day
		// entirely, which would then report the round as having started a day early.
		const havana = 'America/Havana';
		const dayNumber = civilDayNumber(new Date('2020-03-08T12:00:00Z'), havana);
		const start = startOfCivilDay(dayNumber, havana);

		expect(start).toEqual(new Date('2020-03-08T05:00:00Z')); // 01:00 CDT
		expect(civilDayNumber(start, havana)).toBe(dayNumber);
	});

	it('starts the day at the FIRST midnight where midnight happened twice', () => {
		// Gaza falls back through midnight, so 2021-10-29 00:00 occurs at 21:00Z and again at
		// 22:00Z. Taking the later one would put a round's start after the moment its index
		// advanced — a group reporting a round that had not begun.
		const gaza = 'Asia/Gaza';
		const dayNumber = civilDayNumber(new Date('2021-10-29T12:00:00Z'), gaza);
		const start = startOfCivilDay(dayNumber, gaza);

		expect(start).toEqual(new Date('2021-10-28T21:00:00Z'));
		expect(civilDayNumber(start, gaza)).toBe(dayNumber);
		// The hour before must belong to the previous day, or this isn't the first midnight.
		expect(civilDayNumber(new Date(start.getTime() - 1), gaza)).toBe(dayNumber - 1);
	});

	it.each([
		['America/Havana', '2020-03-08'],
		['Asia/Gaza', '2021-10-29'],
		['America/Santiago', '2019-09-08'],
		['Australia/Lord_Howe', '2021-04-04'],
		['Pacific/Apia', '2011-12-31'],
		['Europe/Istanbul', '2026-08-26'],
		['America/New_York', '2027-03-14']
	])('round-trips a civil day in %s on %s', (zone, date) => {
		// The invariant the round math leans on everywhere: whatever instant a day starts at,
		// it must still be that day. Anything else desynchronises roundStartedAtFor from
		// roundIndexSince and a group's stored round stops matching its computed one.
		const dayNumber = civilDayNumber(new Date(`${date}T12:00:00Z`), zone);
		expect(civilDayNumber(startOfCivilDay(dayNumber, zone), zone)).toBe(dayNumber);
	});

	it('never puts a rolled round’s start in the future', () => {
		// Walks a DST-heavy zone hour by hour across both transitions, asserting the pair stay
		// consistent: the round the clock says we are on must have already begun.
		const zone = 'Asia/Gaza';
		const startedAt = new Date('2021-01-01T09:00:00Z');

		for (let hour = 0; hour < 24 * 400; hour += 5) {
			const now = new Date(startedAt.getTime() + hour * 60 * 60 * 1000);
			const index = roundIndexSince(startedAt, DAILY, now, zone);
			const startOfRound = roundStartedAtFor(startedAt, DAILY, index, zone);

			expect(startOfRound.getTime()).toBeLessThanOrEqual(now.getTime());
		}
	});

	it('is decided entirely by the zone passed in, which is why the group must own it', () => {
		const startedAt = new Date('2026-08-26T14:00:00Z');
		const now = new Date('2026-08-27T01:00:00Z');

		// One instant, three zones, three different answers. Nothing here reads an ambient
		// clock, so whichever zone the caller supplies is the whole story — and that is the
		// argument for storing it on the group rather than taking it from whoever asked. If
		// each member supplied their own, these members would disagree about the round and so
		// about whose reads the rollover may wipe.
		expect(roundIndexSince(startedAt, DAILY, now, NEW_YORK)).toBe(0);
		expect(roundIndexSince(startedAt, DAILY, now, UTC)).toBe(1);
		expect(roundIndexSince(startedAt, DAILY, now, ISTANBUL)).toBe(1);
	});
});
