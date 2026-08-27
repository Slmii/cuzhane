import { getAuth } from '@clerk/express';
import type { Request } from 'express';

const FALLBACK_DISPLAY_NAME = 'Member';

/**
 * Best-effort display name for a group member, sourced from Clerk session claims.
 * Falls back to a generic label when no usable claim is present.
 */
export const resolveDisplayName = (req: Request): string => {
	const { sessionClaims } = getAuth(req);
	const claims = sessionClaims as Record<string, unknown> | null | undefined;

	const name = claims?.name;
	if (typeof name === 'string' && name.trim().length > 0) {
		return name.trim();
	}

	const firstName = claims?.firstName;
	if (typeof firstName === 'string' && firstName.trim().length > 0) {
		return firstName.trim();
	}

	const email = claims?.email;
	if (typeof email === 'string' && email.trim().length > 0) {
		return email.trim();
	}

	return FALLBACK_DISPLAY_NAME;
};
