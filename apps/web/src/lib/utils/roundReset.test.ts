import { describe, expect, it } from 'vitest';
import { roundEndPreview, roundResetLabels, timeUntilReset } from './roundReset';

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
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t);

		expect(labels?.group).toContain('time=00:00');
	});

	it('names the offset when the platform only offers a bare "GMT"', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t);

		// The failure this guards: Hermes returns "GMT" for zones it has no abbreviation for,
		// which names the wrong zone entirely.
		expect(labels?.group).toContain('zone=GMT+3');
	});

	it('gives a western zone a negative offset', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'America/New_York', 'en', t);

		expect(labels?.group).toContain('zone=GMT-4');
	});

	it('handles a half-hour zone', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Asia/Kolkata', 'en', t);

		expect(labels?.group).toContain('zone=GMT+5:30');
	});

	it('lowercases the Turkish weekday, as the design writes it mid-sentence', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'tr', t);

		expect(labels?.group).toContain('day=perşembe');
	});

	it('keeps the English weekday capitalised', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'en', t);

		expect(labels?.group).toContain('day=Thursday');
	});

	it('names the weekday on the reader’s side too, since the reset can land a day earlier', () => {
		// 00:00 Thursday in Istanbul is 17:00 Wednesday in New York — saying only "17:00"
		// would read as tonight.
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'en', t);

		expect(labels?.local).toContain('yourTimeAtDay');
	});

	it('omits the weekday for a daily group, which resets every day anyway', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t);

		expect(labels?.local).toContain('yourTimeAt(');
		expect(labels?.local).not.toContain('day=');
	});

	it('returns nothing when the group has no round yet', () => {
		expect(roundResetLabels(null, 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t)).toBeNull();
		expect(roundResetLabels('not-a-date', 'WEEKLY', 1, 'Europe/Istanbul', 'tr', t)).toBeNull();
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

describe('roundResetLabels — a one-off is not a cadence', () => {
	it('states an end date for a one-off, not a rhythm', () => {
		/*
		 * The bug: everything that was not DAILY fell through to the weekly branch, so a
		 * fifteen-day "Özel" hatim read "Her çarşamba 00:00" — a weekday it meets exactly
		 * once, and a repetition that never comes.
		 */
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'CUSTOM', 15, 'Europe/Istanbul', 'tr', t);

		expect(labels?.group).toContain('endsOn');
		expect(labels?.group).not.toContain('day=');
	});

	it('gives a one-off no second line', () => {
		// There is no next round to be early or late for, so "sende …" has nothing to say.
		expect(roundResetLabels(ISTANBUL_MIDNIGHT, 'CUSTOM', 15, 'Europe/Istanbul', 'tr', t)?.local).toBe('');
	});

	it('counts a monthly round in days and dates the next reset, never "every day"', () => {
		const labels = roundResetLabels(ISTANBUL_MIDNIGHT, 'MONTHLY', 30, 'Europe/Istanbul', 'en', t);

		expect(labels?.group).toContain('resetEveryNDays(n=30');
		expect(labels?.group).not.toContain('resetDaily');
		// Midnight in Istanbul is still the 26th for a reader there — the date travels with it.
		expect(labels?.local).toContain('yourTimeAtDate(');
		expect(labels?.local).toContain('date=');
	});

	it('still uses the weekday phrasing at exactly seven days', () => {
		expect(roundResetLabels(ISTANBUL_MIDNIGHT, 'WEEKLY', 7, 'Europe/Istanbul', 'tr', t)?.group).toContain(
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
