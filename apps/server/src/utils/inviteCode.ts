import { randomInt } from 'node:crypto';

export const INVITE_CODE_LENGTH = 8;

// Unambiguous uppercase set — no I, O, 0, 1 — so a spoken/handwritten code can't be misread.
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const INVITE_CODE_ALPHABET_SET = new Set(INVITE_CODE_ALPHABET.split(''));

export const generateInviteCode = (): string => {
	let code = '';

	for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
		code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
	}

	return code;
};

/** Uppercases and strips anything outside the alphabet, so `hatm-4k2p` -> `HATM4K2P`. */
export const normalizeInviteCode = (raw: string): string =>
	raw
		.toUpperCase()
		.split('')
		.filter(char => INVITE_CODE_ALPHABET_SET.has(char))
		.join('');

/** Inserts a dash after the 4th character for display, e.g. `HATM4K2P` -> `HATM-4K2P`. */
export const formatInviteCode = (code: string): string =>
	code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
