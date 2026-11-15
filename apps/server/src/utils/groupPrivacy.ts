import { createHmac } from 'node:crypto';
import { env } from '@config/env';

type PrivacyGroup = {
	id: string;
	ownerUserId: string;
	hideMemberNames: boolean;
	/** A shared Hizb plan's members who see who read (`GroupMember.seesReaders`); none elsewhere. */
	readerSeerIds?: readonly string[];
};

/** Names stay with the owner, the members ticked to see who read, and each member's own. */
export const isAnonymousTo = (group: PrivacyGroup, viewerUserId: string, memberUserId: string | null): boolean =>
	group.hideMemberNames &&
	viewerUserId !== group.ownerUserId &&
	!group.readerSeerIds?.includes(viewerUserId) &&
	memberUserId !== viewerUserId;

/**
 * The members ticked to see who read, for `isAnonymousTo` — only a shared Hizb plan with
 * "Okuma sorumluları" on has any. The ticks are kept while it is off, but mean nothing then.
 */
export const readerSeerIdsOf = (
	group: { readSeersEnabled: boolean },
	members: readonly { userId: string; seesReaders: boolean }[]
): string[] =>
	group.readSeersEnabled ? members.filter(member => member.seesReaders).map(member => member.userId) : [];

/** Keep joins between response rows possible without exposing cross-group account identifiers. */
export const visibleUserId = (group: PrivacyGroup, viewerUserId: string, userId: string | null): string | null =>
	userId && isAnonymousTo(group, viewerUserId, userId)
		? `anonymous:${createHmac('sha256', env.CLERK_SECRET_KEY)
				.update(`${group.id}:${userId}`)
				.digest('hex')
				.slice(0, 24)}`
		: userId;

/** Strip names from both newly recorded and older inbox events when privacy is enabled. */
export const anonymousNotificationPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
	const result: Record<string, unknown> = { ...payload, anonymous: true };
	for (const key of ['readerName', 'takerName', 'memberName']) {
		if (key in result) {
			result[key] = '';
		}
	}
	return result;
};
