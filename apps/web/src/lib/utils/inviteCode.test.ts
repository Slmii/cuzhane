import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { formatInviteCode, inviteLink } from './inviteCode';

/**
 * `InviteQr` pins its symbol to QR version 3 and clears a 5×5 zone in the middle for the mark.
 * That zone is only known to be safe at version 3 — clear of the timing rows and of the single
 * alignment pattern, and within what ECC M can recover. These pin the payload to that version
 * so a change to the link's shape fails here rather than as a code that scans badly.
 */
const INVITE_CODE_LENGTH = 8;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

describe('inviteLink', () => {
	it('carries the bare code, dashed or not', () => {
		expect(inviteLink('HATM-4K2P')).toBe('cuzhane://groups/join/HATM4K2P');
		expect(inviteLink('HATM4K2P')).toBe('cuzhane://groups/join/HATM4K2P');
	});

	it('encodes at QR version 3 under ECC M, the version the emblem zone is cleared for', () => {
		const longest = INVITE_ALPHABET.slice(0, INVITE_CODE_LENGTH);
		const shortest = '2'.repeat(INVITE_CODE_LENGTH);

		for (const code of [longest, shortest, 'HATM4K2P']) {
			const chosen = QRCode.create(inviteLink(code), { errorCorrectionLevel: 'M' });

			expect(chosen.version).toBe(3);
			expect(() => QRCode.create(inviteLink(code), { errorCorrectionLevel: 'M', version: 3 })).not.toThrow();
		}
	});
});

describe('formatInviteCode', () => {
	it('splits a bare code in two for reading aloud', () => {
		expect(formatInviteCode('HATM4K2P')).toBe('HATM-4K2P');
	});
});
