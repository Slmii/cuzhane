type Identity = { userId: string; displayName: string; imageUrl: string | null };
type Privacy = { hideMemberNames: boolean; isOwner: boolean; seesReaders?: boolean };

/**
 * The current policy also protects older cached responses while they refetch. Names show to the
 * owner and, in a shared Hizb plan, to the members ticked to see who read.
 */
export const visibleMemberIdentity = <T extends Identity>(
	member: T,
	group: Privacy | undefined,
	viewerUserId: string | null,
	anonymousName: string
): T =>
	member.userId.startsWith('anonymous:') ||
	(group?.hideMemberNames && !group.isOwner && !group.seesReaders && member.userId !== viewerUserId)
		? { ...member, displayName: anonymousName, imageUrl: null }
		: member;
