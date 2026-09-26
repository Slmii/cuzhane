type Identity = { userId: string; displayName: string; imageUrl: string | null };
type Privacy = { hideMemberNames: boolean; isOwner: boolean };

/** The current policy also protects older cached responses while they refetch. */
export const visibleMemberIdentity = <T extends Identity>(
	member: T,
	group: Privacy | undefined,
	viewerUserId: string | null,
	anonymousName: string
): T =>
	member.userId.startsWith('anonymous:') ||
	(group?.hideMemberNames && !group.isOwner && member.userId !== viewerUserId)
		? { ...member, displayName: anonymousName, imageUrl: null }
		: member;
