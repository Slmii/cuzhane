import { FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { GroupMember } from '../generated/prisma/client';

export const getMembership = async (userId: string, groupId: string): Promise<GroupMember | null> => {
	return prisma.groupMember.findUnique({
		where: { groupId_userId: { groupId, userId: normalizeUserId(userId) } }
	});
};

/** Hides the group's existence from non-members by reusing NOT_FOUND. */
export const requireMembership = async (userId: string, groupId: string): Promise<GroupMember> => {
	const membership = await getMembership(userId, groupId);

	if (!membership) {
		throw new HttpError(NOT_FOUND, 'Group not found');
	}

	return membership;
};

export const requireOwner = async (userId: string, groupId: string): Promise<GroupMember> => {
	const membership = await requireMembership(userId, groupId);

	if (membership.role !== 'OWNER') {
		throw new HttpError(FORBIDDEN, 'Only the group owner can do this');
	}

	return membership;
};

/** Lowest 0-based seat index not currently taken, or null when every seat is filled. */
export const nextFreeSlotIndex = async (groupId: string, spots: number): Promise<number | null> => {
	const members = await prisma.groupMember.findMany({
		where: { groupId },
		select: { slotIndex: true }
	});

	const taken = new Set(members.map(member => member.slotIndex));

	for (let slot = 0; slot < spots; slot++) {
		if (!taken.has(slot)) {
			return slot;
		}
	}

	return null;
};
