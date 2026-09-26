import { describe, expect, it } from 'vitest';
import { cadenceLabel, roundResetLabels, roundTimeLeftLabel, timeUntilReset } from './roundReset';

// Stands in for the app's `t`: renders the key with its values substituted, so a test can
// assert on the pieces that were passed in rather than on Turkish copy.
const t = (key: string, values: Record<string, string>) =>
	`${key}(${Object.entries(values)
		.map(([name, value]) => `${name}=${value}`)
		.join(',')})`;

// Local midnight in Istanbul on a Thursday — 21:00 UTC the day before.
const ISTANBUL_MIDNIGHT = '2026-08-26T21:00:00.000Z';

describe('roundResetLabels', () => {
	it('reports the group side as midnight in the group’s own zone', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'DAILY', 'Europe/Istanbul', 'tr', t);

		expect(labels?.group).toContain('time=00:00');
	});

	it('names the offset when the platform only offers a bare "GMT"', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'DAILY', 'Europe/Istanbul', 'tr', t);

		// The failure this guards: Hermes returns "GMT" for zones it has no abbreviation for,
		// which names the wrong zone entirely.
		expect(labels?.group).toContain('zone=GMT+3');
	});

	it('gives a western zone a negative offset', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'DAILY', 'America/New_York', 'en', t);

		expect(labels?.group).toContain('zone=GMT-4');
	});

	it('handles a half-hour zone', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'DAILY', 'Asia/Kolkata', 'en', t);

		expect(labels?.group).toContain('zone=GMT+5:30');
	});

	it('lowercases the Turkish weekday, as the design writes it mid-sentence', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 'Europe/Istanbul', 'tr', t);

		expect(labels?.group).toContain('day=perşembe');
	});

	it('keeps the English weekday capitalised', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 'Europe/Istanbul', 'en', t);

		expect(labels?.group).toContain('day=Thursday');
	});

	it('names the weekday on the reader’s side too, since the reset can land a day earlier', () => {
		// 00:00 Thursday in Istanbul is 17:00 Wednesday in New York — saying only "17:00"
		// would read as tonight.
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 'Europe/Istanbul', 'en', t);

		expect(labels?.local).toContain('yourTimeAtDay');
	});

	it('omits the weekday for a daily group, which resets every day anyway', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'DAILY', 'Europe/Istanbul', 'tr', t);

		expect(labels?.local).toContain('yourTimeAt(');
		expect(labels?.local).not.toContain('day=');
	});

	describe('a monthly group', () => {
		// Started at 01:00 on 31 January in Istanbul — still the 30th in UTC.
		const STARTED_ON_THE_31ST = '2026-01-30T22:00:00.000Z';
		// Its next boundary, clamped: 00:00 on 28 February in Istanbul.
		const CLAMPED_FEBRUARY = '2026-02-27T21:00:00.000Z';

		it('names the start’s day of the month, not the clamped day this month lands on', () => {
			const labels = roundResetLabels(
				CLAMPED_FEBRUARY,
				'MONTHLY',
				'Europe/Istanbul',
				'tr',
				t,
				STARTED_ON_THE_31ST
			);

			expect(labels?.group).toBe('resetMonthly(day=31,time=00:00,zone=GMT+3)');
		});

		it('reads the start’s day in the group’s zone, where the month turns', () => {
			const labels = roundResetLabels(
				CLAMPED_FEBRUARY,
				'MONTHLY',
				'Europe/Istanbul',
				'en',
				t,
				STARTED_ON_THE_31ST
			);

			// The 30th would be the day in UTC, or anywhere west of the start's midnight.
			expect(labels?.group).toContain('day=31');
		});

		it('falls back to the boundary’s own day when the start is not known', () => {
			const labels = roundResetLabels(CLAMPED_FEBRUARY, 'MONTHLY', 'Europe/Istanbul', 'tr', t);

			expect(labels?.group).toContain('day=28');
		});

		it('dates the reader’s side, since a weekday says nothing about which month', () => {
			const labels = roundResetLabels(
				CLAMPED_FEBRUARY,
				'MONTHLY',
				'Europe/Istanbul',
				'en',
				t,
				STARTED_ON_THE_31ST
			);

			expect(labels?.local).toContain('yourTimeAtDay(');
			expect(labels?.local).toMatch(/day=(February \d+|\d+ February)/);
		});
	});

	it('returns nothing when the group has no round yet', () => {
		expect(roundResetLabels(null, 'DAILY', 'Europe/Istanbul', 'tr', t)).toBeNull();
		expect(roundResetLabels('not-a-date', 'DAILY', 'Europe/Istanbul', 'tr', t)).toBeNull();
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
