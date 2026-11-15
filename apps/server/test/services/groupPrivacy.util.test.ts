import { anonymousNotificationPayload, isAnonymousTo, visibleUserId } from '@utils/groupPrivacy';
import { describe, expect, it } from 'vitest';

const hidden = { hideMemberNames: true, id: 'group-1', ownerUserId: 'owner' };
const shown = { ...hidden, hideMemberNames: false };

describe('hidden member names', () => {
	it('hide other members from a member, but never from the owner or from themselves', () => {
		expect(isAnonymousTo(hidden, 'viewer', 'member')).toBe(true);
		expect(isAnonymousTo(hidden, 'owner', 'member')).toBe(false);
		expect(isAnonymousTo(hidden, 'viewer', 'viewer')).toBe(false);
		expect(isAnonymousTo(shown, 'viewer', 'member')).toBe(false);
	});

	it('replace another member’s id with a stable per-group alias', () => {
		const alias = visibleUserId(hidden, 'viewer', 'member');

		expect(alias).toMatch(/^anonymous:[0-9a-f]{24}$/);
		expect(alias).not.toContain('member');
		// Stable, so rows can still be joined; different per member and per group.
		expect(visibleUserId(hidden, 'someone-else', 'member')).toBe(alias);
		expect(visibleUserId(hidden, 'viewer', 'member-2')).not.toBe(alias);
		expect(visibleUserId({ ...hidden, id: 'group-2' }, 'viewer', 'member')).not.toBe(alias);
	});

	it('leave ids alone where names are shown, for the owner, for the viewer, and for nobody', () => {
		expect(visibleUserId(shown, 'viewer', 'member')).toBe('member');
		expect(visibleUserId(hidden, 'owner', 'member')).toBe('member');
		expect(visibleUserId(hidden, 'viewer', 'viewer')).toBe('viewer');
		expect(visibleUserId(hidden, 'viewer', null)).toBeNull();
	});

	it('blank every name in an inbox payload and flag it, keeping the rest', () => {
		expect(
			anonymousNotificationPayload({ memberCount: 4, memberName: 'Ayşe', readerName: 'Ali', takerName: 'Can' })
		).toEqual({ anonymous: true, memberCount: 4, memberName: '', readerName: '', takerName: '' });
		// A key that was never there is not invented.
		expect(anonymousNotificationPayload({ memberCount: 2 })).toEqual({ anonymous: true, memberCount: 2 });
	});
});
