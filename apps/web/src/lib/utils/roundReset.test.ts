import { describe, expect, it } from 'vitest';
import { cadenceLabel, roundEndPreview, roundResetLabels, roundTimeLeftLabel, timeUntilReset } from './roundReset';

// Stands in for the app's `t`: renders the key with its values substituted, so a test can
// assert on the pieces that were passed in rather than on Turkish copy.
const t = (key: string, values: Record<string, string | number>) =>
	`${key}(${Object.entries(values)
		.map(([name, value]) => `${name}=${value}`)
		.join(',')})`;

// Local midnight in Istanbul on a Thursday — 21:00 UTC the day before.
const ISTANBUL_MIDNIGHT = '2026-08-26T21:00:00.000Z';

describe('roundResetLabels', () => {
	it('reports the group side as midnight in the group’s own zone', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t, 'CEVSEN');

		expect(labels?.group).toContain('time=00:00');
	});

	it('names the offset when the platform only offers a bare "GMT"', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t, 'CEVSEN');

		// The failure this guards: Hermes returns "GMT" for zones it has no abbreviation for,
		// which names the wrong zone entirely.
		expect(labels?.group).toContain('zone=GMT+3');
	});

	it('gives a western zone a negative offset', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'America/New_York', 'en', t, 'CEVSEN');

		expect(labels?.group).toContain('zone=GMT-4');
	});

	it('handles a half-hour zone', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Asia/Kolkata', 'en', t, 'CEVSEN');

		expect(labels?.group).toContain('zone=GMT+5:30');
	});

	it('lowercases the Turkish weekday, as the design writes it mid-sentence', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'tr', t, 'CEVSEN');

		expect(labels?.group).toContain('day=perşembe');
	});

	it('keeps the English weekday capitalised', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'en', t, 'CEVSEN');

		expect(labels?.group).toContain('day=Thursday');
	});

	it('names the weekday on the reader’s side too, since the reset can land a day earlier', () => {
		// 00:00 Thursday in Istanbul is 17:00 Wednesday in New York — saying only "17:00"
		// would read as tonight.
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'en', t, 'CEVSEN');

		expect(labels?.local).toContain('yourTimeAtDay');
	});

	it('omits the weekday for a daily group, which resets every day anyway', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t, 'CEVSEN');

		expect(labels?.local).toContain('yourTimeAt(');
		expect(labels?.local).not.toContain('day=');
	});

	describe('a monthly Hizb group, which rolls on a calendar month', () => {
		// Started at 01:00 on 31 January in Istanbul — still the 30th in UTC.
		const STARTED_ON_THE_31ST = '2026-01-30T22:00:00.000Z';
		// Its next boundary, clamped: 00:00 on 28 February in Istanbul.
		const CLAMPED_FEBRUARY = '2026-02-27T21:00:00.000Z';

		it('names the start’s day of the month, not the clamped day this month lands on', () => {
			const labels = roundResetLabels(
				CLAMPED_FEBRUARY,
				'MONTHLY',
				30,
				'Europe/Istanbul',
				'tr',
				t,
				'HIZB',
				STARTED_ON_THE_31ST
			);

			expect(labels?.group).toBe('resetMonthly(day=31,time=00:00,zone=GMT+3)');
		});

		it('reads the start’s day in the group’s zone, where the month turns', () => {
			const labels = roundResetLabels(
				CLAMPED_FEBRUARY,
				'MONTHLY',
				30,
				'Europe/Istanbul',
				'en',
				t,
				'HIZB',
				STARTED_ON_THE_31ST
			);

			// The 30th would be the day in UTC, or anywhere west of the start's midnight.
			expect(labels?.group).toContain('day=31');
		});

		it('falls back to the boundary’s own day when the start is not known', () => {
			const labels = roundResetLabels(CLAMPED_FEBRUARY, 'MONTHLY', 30, 'Europe/Istanbul', 'tr', t, 'HIZB');

			expect(labels?.group).toContain('day=28');
		});

		it('dates the reader’s side, since a weekday says nothing about which month', () => {
			const labels = roundResetLabels(
				CLAMPED_FEBRUARY,
				'MONTHLY',
				30,
				'Europe/Istanbul',
				'en',
				t,
				'HIZB',
				STARTED_ON_THE_31ST
			);

			expect(labels?.local).toContain('yourTimeAtDay(');
			expect(labels?.local).toMatch(/day=(February \d+|\d+ February)/);
		});
	});

	it('returns nothing when the group has no round yet', () => {
		expect(roundResetLabels(null, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t, 'CEVSEN')).toBeNull();
		expect(roundResetLabels('not-a-date', 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t, 'CEVSEN')).toBeNull();
	});
});

describe('timeUntilReset', () => {
	it('splits the remainder into whole hours and minutes', () => {
		const now = new Date('2026-08-26T14:30:00.000Z');

		expect(timeUntilReset(ISTANBUL_MIDNIGHT, now)).toEqual({ hours: 6, minutes: 30 });
	});

	it('floors to zero once the boundary has passed rather than going negative', () => {
		const now = new Date('2026-08-27T02:00:00.000Z');

		expect(timeUntilReset(ISTANBUL_MIDNIGHT, now)).toEqual({ hours: 0, minutes: 0 });
	});

	it('is zero for a group with no round', () => {
		expect(timeUntilReset(null)).toEqual({ hours: 0, minutes: 0 });
	});
});

describe('cadenceLabel', () => {
	// 01:00 on Monday 5 January in Istanbul — still Sunday the 4th in UTC.
	const STARTED_MONDAY_IN_ISTANBUL = '2026-01-04T22:00:00.000Z';

	it('names a daily group by its cycle alone', () => {
		expect(cadenceLabel('DAILY', STARTED_MONDAY_IN_ISTANBUL, 'Europe/Istanbul', 'tr', t)).toBe('daily()');
	});

	it('names a weekly group’s weekday, read in the group’s zone', () => {
		expect(cadenceLabel('WEEKLY', STARTED_MONDAY_IN_ISTANBUL, 'Europe/Istanbul', 'en', t)).toBe(
			'weekly() · Monday'
		);
		expect(cadenceLabel('WEEKLY', STARTED_MONDAY_IN_ISTANBUL, 'UTC', 'en', t)).toBe('weekly() · Sunday');
	});

	it('keeps the Turkish weekday capitalised, since it follows a separator', () => {
		expect(cadenceLabel('WEEKLY', STARTED_MONDAY_IN_ISTANBUL, 'Europe/Istanbul', 'tr', t)).toBe(
			'weekly() · Pazartesi'
		);
	});

	it('names a monthly group’s day of the month, read in the group’s zone', () => {
		expect(cadenceLabel('MONTHLY', STARTED_MONDAY_IN_ISTANBUL, 'Europe/Istanbul', 'tr', t)).toBe(
			'monthly() · cadenceMonthDay(day=5)'
		);
		expect(cadenceLabel('MONTHLY', STARTED_MONDAY_IN_ISTANBUL, 'UTC', 'tr', t)).toBe(
			'monthly() · cadenceMonthDay(day=4)'
		);
	});

	it('names only the cycle before the group has started, when no day is decided', () => {
		expect(cadenceLabel('WEEKLY', null, 'Europe/Istanbul', 'tr', t)).toBe('weekly()');
		expect(cadenceLabel('MONTHLY', null, 'Europe/Istanbul', 'tr', t)).toBe('monthly()');
		expect(cadenceLabel('MONTHLY', 'not-a-date', 'Europe/Istanbul', 'tr', t)).toBe('monthly()');
	});
});

describe('roundTimeLeftLabel', () => {
	// The key and its values, so each case asserts which string was chosen and with what.
	const label = (key: string, values?: Record<string, string | number>) =>
		values ? `${key}(${Object.values(values).join(',')})` : key;
	const left = (cycle: 'DAILY' | 'WEEKLY' | 'MONTHLY', daysLeft: number | null) =>
		roundTimeLeftLabel({ cycle, daysLeft, hours: 4, minutes: 12 }, label);

	it('counts a DAILY round down in hours, whatever the day count says', () => {
		expect(left('DAILY', 1)).toBe('hoursLeft(4,12)');
	});

	it('counts the last day of a longer round in hours rather than as 0 days', () => {
		expect(left('WEEKLY', 0)).toBe('hoursLeft(4,12)');
		expect(left('MONTHLY', 0)).toBe('hoursLeft(4,12)');
	});

	it('gives one day its own word', () => {
		expect(left('WEEKLY', 1)).toBe('dayCountOne');
	});

	it('counts the rest in days', () => {
		expect(left('MONTHLY', 12)).toBe('dayCount(12)');
	});

	it('shows a dash for a group with no end on record', () => {
		expect(left('WEEKLY', null)).toBe('—');
	});
});

describe('roundResetLabels — a one-off is not a cadence', () => {
	it('states an end date for a one-off, not a rhythm', () => {
		/*
		 * The bug: everything that was not DAILY fell through to the weekly branch, so a
		 * fifteen-day "Özel" hatim read "Her çarşamba 00:00" — a weekday it meets exactly
		 * once, and a repetition that never comes.
		 */
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'CUSTOM', 15, 'Europe/Istanbul', 'tr', t, 'HATIM');

		expect(labels?.group).toContain('endsOn');
		expect(labels?.group).not.toContain('day=');
	});

	it('gives a one-off no second line', () => {
		// There is no next round to be early or late for, so "sende …" has nothing to say.
		expect(roundResetLabels(ISTANBUL_MIDNIGHT, 'CUSTOM', 15, 'Europe/Istanbul', 'tr', t, 'HATIM')?.local).toBe('');
	});

	it('counts a monthly round in days and dates the next reset, never "every day"', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'MONTHLY', 30, 'Europe/Istanbul', 'en', t, 'HATIM');

		expect(labels?.group).toContain('resetEveryNDays(n=30');
		expect(labels?.group).not.toContain('resetDaily');
		// Midnight in Istanbul is still the 26th for a reader there — the date travels with it.
		expect(labels?.local).toContain('yourTimeAtDate(');
		expect(labels?.local).toContain('date=');
	});

	it('still uses the weekday phrasing at exactly seven days', () => {
		expect(roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'tr', t, 'CEVSEN')?.group).toContain(
			'resetWeekly'
		);
	});
});

describe('roundEndPreview', () => {
	it('lands N calendar days out, not N × 24 hours', () => {
		// Adding days to the date rather than milliseconds to an instant is what makes a DST
		// day count as one day — the bug that once put a reset at 20:00 the previous evening.
		const today = new Date();
		const expected = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);
		const label = roundEndPreview(10, 'tr-TR');

		expect(label).toBe(
			new Intl.DateTimeFormat('tr-TR', {
				day: 'numeric',
				month: 'short',
				weekday: 'short',
				year: 'numeric'
			}).format(expected)
		);
	});

	it('carries the year, so a round crossing one is not ambiguous', () => {
		// Ninety days out from December lands in the next year, and a bare "28 Oca" reads as a
		// date already past.
		expect(roundEndPreview(90, 'tr-TR')).toMatch(/\d{4}/);
	});

	it('stays on one line: abbreviated, and never the spelled-out form', () => {
		// The row it feeds is a label and a value side by side, and the long English form
		// ("Saturday, September 29, 2026") is wider than that — RN then breaks before the
		// year and draws neither the break nor the year, leaving a row ending in a comma.
		const label = roundEndPreview(7, 'en-US');

		expect(label).not.toMatch(/September|October|Saturday|Sunday/);
		expect(label).toMatch(/\d{4}/);
	});

	it('never previews an end before tomorrow', () => {
		// A stepper cannot reach zero, but the floor is what stops a bad value rendering today
		// as the end of a round that has not started.
		expect(roundEndPreview(0, 'tr-TR')).toBe(roundEndPreview(1, 'tr-TR'));
	});
});
