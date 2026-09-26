import { getAuth } from '@clerk/express';
import type { Request } from 'express';

const FALLBACK_DISPLAY_NAME = 'Member';

/**
 * Best-effort display name for a group member, sourced from Clerk session claims.
 * Falls back to a generic label when no usable claim is present — **never to the email
 * address**: a name is shown to every member of the group, and the owner's to anyone who
 * previews an open group, so an email here would publish it.
 *
 * **Mirrored on the client** by `useViewerDisplayName`, which needs to predict what this
 * will return so an optimistic row can draw the viewer's avatar before the server answers —
 * those faces are seeded on the name, so a wrong guess redraws as a different person.
 * Changing the order here means changing it there.
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

	return FALLBACK_DISPLAY_NAME;
};
