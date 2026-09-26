import { createHmac } from 'node:crypto';
import { env } from '@config/env';

type PrivacyGroup = { id: string; ownerUserId: string; hideMemberNames: boolean };

export const isAnonymousTo = (group: PrivacyGroup, viewerUserId: string, memberUserId: string | null): boolean =>
	group.hideMemberNames && viewerUserId !== group.ownerUserId && memberUserId !== viewerUserId;

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
