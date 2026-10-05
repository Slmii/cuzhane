import { describe, expect, it } from 'vitest';
import { whatsNewDecision, whatsNewStorageKey, type WhatsNewInput } from './whatsNew';

describe('whatsNewStorageKey', () => {
	it('keeps the key production has always used, so nobody is shown a release twice', () => {
		expect(whatsNewStorageKey(null)).toBe('whatsNew.lastSeenReleaseId');
	});

	it('gives preview and development a key of their own', () => {
		expect(whatsNewStorageKey('preview')).toBe('whatsNew.lastSeenReleaseId.preview');
		expect(whatsNewStorageKey('development')).toBe('whatsNew.lastSeenReleaseId.development');
		expect(whatsNewStorageKey('preview')).not.toBe(whatsNewStorageKey(null));
	});
});

const decide = (overrides: Partial<WhatsNewInput> = {}) =>
	whatsNewDecision({
		currentReleaseId: 'release-2',
		isBlocked: false,
		isFocused: true,
		isHintShowing: false,
		isNewcomer: false,
		isWelcomePending: false,
		lastSeenReleaseId: 'release-1',
		...overrides
	});

describe('whatsNewDecision', () => {
	it('waits while the hints are still unknown', () => {
		expect(decide({ isWelcomePending: undefined })).toBe('wait');
	});

	it('waits while the splash still owns the screen', () => {
		// Seen on device: the sheet is presented by UIKit above everything, so without this it
		// opened over the animated splash. Newcomers wait too — nothing is recorded either way
		// until the app is actually on screen.
		expect(decide({ isBlocked: true })).toBe('wait');
		expect(decide({ isBlocked: true, isNewcomer: true })).toBe('wait');
	});

	it('waits while Ana sayfa is mounted but not the screen being looked at', () => {
		// The tabs are not lazy, so Home mounts on launch whatever tab the app opens onto — a
		// scanned invite lands on Gruplarım with the join sheet already up.
		expect(decide({ isFocused: false })).toBe('wait');
		expect(decide({ isFocused: false, isNewcomer: true })).toBe('wait');
	});

	describe('an existing reader who has not seen the welcome', () => {
		it('waits while the welcome is still ahead of them', () => {
			expect(decide({ isWelcomePending: true })).toBe('wait');
		});

		it('still waits while a hint is on screen', () => {
			expect(decide({ isHintShowing: true, isWelcomePending: false })).toBe('wait');
		});

		it('is shown the notes once the welcome is seen and no hint is up', () => {
			expect(decide({ isHintShowing: false, isWelcomePending: false })).toBe('show');
		});
	});

	describe('an existing reader who saw the welcome long ago', () => {
		it('waits for a hint’s card to go', () => {
			expect(decide({ isHintShowing: true })).toBe('wait');
		});

		it('is shown the notes straight away', () => {
			expect(decide()).toBe('show');
		});

		it('is shown nothing twice for the same release', () => {
			expect(decide({ lastSeenReleaseId: 'release-2' })).toBe('record');
		});

		it('is shown the notes on an install that has never recorded a version', () => {
			// The release that introduces the feature: the key has never been written on any
			// device, so this is what every existing reader looks like on its first launch.
			expect(decide({ lastSeenReleaseId: null })).toBe('show');
		});
	});

	describe('a newcomer, in the launch they onboarded in', () => {
		it('records the release without being shown it', () => {
			expect(decide({ isNewcomer: true, isWelcomePending: true, lastSeenReleaseId: null })).toBe('record');
		});

		it('is not shown it after their welcome either', () => {
			expect(decide({ isNewcomer: true, isWelcomePending: false, lastSeenReleaseId: null })).toBe('record');
		});

		it('is not made to wait by their own welcome being on screen', () => {
			expect(
				decide({ isHintShowing: true, isNewcomer: true, isWelcomePending: true, lastSeenReleaseId: null })
			).toBe('record');
		});

		it('is an ordinary reader by the next release', () => {
			// `isNewcomer` is a fact about a launch, so it is false by then — and the version they
			// recorded on arrival is no longer the current one.
			expect(decide({ currentReleaseId: 'release-3', lastSeenReleaseId: 'release-2' })).toBe('show');
		});
	});
});
