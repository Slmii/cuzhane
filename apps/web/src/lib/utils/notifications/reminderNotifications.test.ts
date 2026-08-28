import { describe, expect, it } from 'vitest';
import { buildContentSignature, buildTriggerSignature } from './reminderSignatures';

/**
 * The signatures are the whole reconciler: they decide whether an app launch leaves the
 * scheduled reminder alone or tears it down and rebuilds it. Two properties matter — the
 * same settings must always produce the same string, and any change a reader can make must
 * produce a different one.
 */
describe('buildTriggerSignature', () => {
	it('is stable for the same schedule', () => {
		expect(buildTriggerSignature({ isEnabled: true, time: '21:30' })).toBe(
			buildTriggerSignature({ isEnabled: true, time: '21:30' })
		);
	});

	it('changes when the time changes', () => {
		expect(buildTriggerSignature({ isEnabled: true, time: '21:30' })).not.toBe(
			buildTriggerSignature({ isEnabled: true, time: '07:00' })
		);
	});

	it('changes when the reminder is switched off', () => {
		expect(buildTriggerSignature({ isEnabled: true, time: '21:30' })).not.toBe(
			buildTriggerSignature({ isEnabled: false, time: '21:30' })
		);
	});

	it('does not confuse 07:00 with 7:00', () => {
		// The settings write `HH:mm`, but a hand-edited row could hold either. They schedule
		// the same trigger, so treating them as different only causes a needless rebuild —
		// this pins the current behaviour so a future normalisation is a deliberate change.
		expect(buildTriggerSignature({ isEnabled: true, time: '07:00' })).not.toBe(
			buildTriggerSignature({ isEnabled: true, time: '7:00' })
		);
	});
});

describe('buildContentSignature', () => {
	it('is stable for the same wording', () => {
		expect(buildContentSignature({ body: '3 bab', title: 'Cüzhane · Sas' })).toBe(
			buildContentSignature({ body: '3 bab', title: 'Cüzhane · Sas' })
		);
	});

	it('changes when the count in the body changes', () => {
		// This is what makes the pending notification follow the reader's progress: finishing
		// a bab changes the body, so the next sync replaces the stale one.
		expect(buildContentSignature({ body: '3 bab', title: 'Cüzhane · Sas' })).not.toBe(
			buildContentSignature({ body: '2 bab', title: 'Cüzhane · Sas' })
		);
	});

	it('changes when the group in the title changes', () => {
		expect(buildContentSignature({ body: '3 bab', title: 'Cüzhane · Sas' })).not.toBe(
			buildContentSignature({ body: '3 bab', title: 'Cüzhane · Seher Hatmi' })
		);
	});

	it('is independent of the trigger signature', () => {
		// Wording and schedule are compared separately so a changed count doesn't move the
		// fire time, and vice versa.
		expect(buildContentSignature({ body: '3 bab', title: 'Cüzhane · Sas' })).not.toBe(
			buildTriggerSignature({ isEnabled: true, time: '21:30' })
		);
	});
});
