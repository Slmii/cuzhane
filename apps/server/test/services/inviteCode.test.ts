import {
	formatInviteCode,
	generateInviteCode,
	INVITE_CODE_ALPHABET,
	INVITE_CODE_LENGTH,
	normalizeInviteCode
} from '@utils/inviteCode';
import { describe, expect, it } from 'vitest';

describe('inviteCode util', () => {
	describe('normalizeInviteCode', () => {
		it('uppercases and strips non-alphabet characters', () => {
			expect(normalizeInviteCode('hatm-4k2p')).toBe('HATM4K2P');
		});

		it('drops ambiguous characters like I, O, 0, 1', () => {
			expect(normalizeInviteCode('IO01abc')).toBe('ABC');
		});
	});

	describe('formatInviteCode', () => {
		it('inserts a dash after the 4th character', () => {
			expect(formatInviteCode('HATM4K2P')).toBe('HATM-4K2P');
		});

		it('leaves short codes untouched', () => {
			expect(formatInviteCode('HATM')).toBe('HATM');
		});
	});

	describe('generateInviteCode', () => {
		it('always returns 8 characters from the invite code alphabet', () => {
			const alphabetSet = new Set(INVITE_CODE_ALPHABET.split(''));

			for (let i = 0; i < 200; i++) {
				const code = generateInviteCode();
				expect(code).toHaveLength(INVITE_CODE_LENGTH);

				for (const char of code) {
					expect(alphabetSet.has(char)).toBe(true);
				}
			}
		});
	});
});
