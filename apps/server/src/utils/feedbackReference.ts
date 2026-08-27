import { randomInt } from 'node:crypto';

/**
 * The handle a sender is given for their message — the design's `#CV-4821`, stored
 * without the `#` because the hash is punctuation the screen adds, not part of the value.
 *
 * Four characters after the prefix, matching the design's shape, but drawn from the
 * invite alphabet rather than digits: four digits is ten thousand references and starts
 * colliding within a few hundred messages, while the same four slots over 32 unambiguous
 * characters is a million. It still reads as a short code the sender can quote back.
 */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERENCE_LENGTH = 4;
const REFERENCE_PREFIX = 'CV-';

export const generateFeedbackReference = (): string => {
	let suffix = '';

	for (let i = 0; i < REFERENCE_LENGTH; i++) {
		suffix += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
	}

	return `${REFERENCE_PREFIX}${suffix}`;
};
