import { describe, expect, it } from 'vitest';
import { buildReminderKey, isSameReminderSet, type ReminderNotice } from './reminderSignatures';

/**
 * The keys are the whole reconciler: they decide whether an app launch leaves the scheduled
 * reminders alone or rebuilds them. The same reminder must always give the same key, and any
 * change a reader can make — a count, a time, a day, a switch — must give a different set.
 */
const notice = (overrides: Partial<ReminderNotice> = {}): ReminderNotice => ({
	at: new Date(2026, 9, 3, 21, 30),
	body: '3 babın kaldı',
	book: 'cevsen',
	title: 'Cüzhane · Bugün',
	...overrides
});

describe('buildReminderKey', () => {
	it('is stable for the same reminder', () => {
		expect(buildReminderKey(notice())).toBe(buildReminderKey(notice()));
	});

	it('changes with the count, the moment and the book', () => {
		const key = buildReminderKey(notice());

		expect(buildReminderKey(notice({ body: '2 babın kaldı' }))).not.toBe(key);
		expect(buildReminderKey(notice({ at: new Date(2026, 9, 3, 15, 0) }))).not.toBe(key);
		expect(buildReminderKey(notice({ book: 'hizb' }))).not.toBe(key);
	});
});

describe('isSameReminderSet', () => {
	const today = notice();
	const tomorrow = notice({ at: new Date(2026, 9, 4, 21, 30), body: 'Bugünkü payını görmek için dokun.' });

	it('leaves the set alone when the OS holds exactly what is wanted, in any order', () => {
		expect(isSameReminderSet([buildReminderKey(tomorrow), buildReminderKey(today)], [today, tomorrow])).toBe(true);
	});

	it('rebuilds when one is missing, extra, or changed', () => {
		expect(isSameReminderSet([buildReminderKey(today)], [today, tomorrow])).toBe(false);
		expect(isSameReminderSet([buildReminderKey(today), buildReminderKey(tomorrow)], [today])).toBe(false);
		expect(isSameReminderSet([buildReminderKey(today)], [notice({ body: '2 babın kaldı' })])).toBe(false);
	});

	it('rebuilds over an older build’s repeating reminder, which carries no key', () => {
		expect(isSameReminderSet([null], [today])).toBe(false);
	});
});
