import { describe, expect, it } from 'vitest';
import { visibleMemberIdentity } from './groupPrivacy';

const member = { userId: 'other', displayName: 'Ali', imageUrl: 'photo.jpg' };

describe('visibleMemberIdentity', () => {
	it('hides stale cached names and photos as soon as privacy becomes enabled', () => {
		expect(visibleMemberIdentity(member, { hideMemberNames: true, isOwner: false }, 'me', 'Anonymous')).toEqual({
			...member,
			displayName: 'Anonymous',
			imageUrl: null
		});
	});
	it('preserves the viewer and owner access', () => {
		expect(visibleMemberIdentity(member, { hideMemberNames: true, isOwner: false }, 'other', 'Anonymous')).toBe(
			member
		);
		expect(visibleMemberIdentity(member, { hideMemberNames: true, isOwner: true }, 'me', 'Anonymous')).toBe(member);
	});
	it('shows names to a member ticked to see who read, and to them only', () => {
		const ticked = { hideMemberNames: true, isOwner: false, seesReaders: true };
		expect(visibleMemberIdentity(member, ticked, 'me', 'Anonymous')).toBe(member);
		expect(visibleMemberIdentity(member, { ...ticked, seesReaders: false }, 'me', 'Anonymous').displayName).toBe(
			'Anonymous'
		);
	});
	it('localizes anonymous server identities even before the group policy arrives', () => {
		expect(visibleMemberIdentity({ ...member, userId: 'anonymous:123' }, undefined, 'me', 'Lid').displayName).toBe(
			'Lid'
		);
	});
});
