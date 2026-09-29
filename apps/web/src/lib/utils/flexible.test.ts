import { describe, expect, it } from 'vitest';
import { flexiblePortionState } from './flexible';

describe('flexiblePortionState', () => {
	it('offers an unclaimed unread portion', () => {
		expect(flexiblePortionState({ isRead: false, takenByMe: false, takenByUserId: null })).toBe('available');
	});
	it('allows own unread claims to be read or released', () => {
		expect(flexiblePortionState({ isRead: false, takenByMe: true, takenByUserId: 'me' })).toBe('mine');
	});
	it('does not offer another member’s claim', () => {
		expect(flexiblePortionState({ isRead: false, takenByMe: false, takenByUserId: 'other' })).toBe('claimed');
	});
	it('keeps completed portions closed even if the claim was cleared', () => {
		expect(flexiblePortionState({ isRead: true, takenByMe: false, takenByUserId: null })).toBe('read');
		expect(flexiblePortionState({ isRead: true, takenByMe: true, takenByUserId: 'me' })).toBe('read');
	});
});
