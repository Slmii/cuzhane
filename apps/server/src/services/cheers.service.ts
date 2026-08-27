import { BAD_REQUEST } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { requireMembership } from '@services/groupAccess.service';
import { normalizeUserId } from '@utils/normalizeUserId';

export const toggleCheerForUser = async (
	userId: string,
	groupId: string,
	toUserId: string
): Promise<{ cheered: boolean }> => {
	const normalizedUserId = normalizeUserId(userId);
	const normalizedToUserId = normalizeUserId(toUserId);

	if (normalizedUserId === normalizedToUserId) {
		throw new HttpError(BAD_REQUEST, 'You cannot cheer yourself');
	}

	await requireMembership(normalizedUserId, groupId);
	await requireMembership(normalizedToUserId, groupId);

	const existing = await prisma.cheer.findUnique({
		where: {
			groupId_fromUserId_toUserId: {
				groupId,
				fromUserId: normalizedUserId,
				toUserId: normalizedToUserId
			}
		}
	});

	if (existing) {
		await prisma.cheer.delete({ where: { id: existing.id } });
		return { cheered: false };
	}

	await prisma.cheer.create({
		data: { groupId, fromUserId: normalizedUserId, toUserId: normalizedToUserId }
	});

	return { cheered: true };
};
