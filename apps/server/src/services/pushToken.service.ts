import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';

/**
 * Register an Expo push token for a user. Tokens are globally unique — if the same
 * device token was previously tied to another user (e.g. account switch on one device),
 * it is re-assigned to the current user.
 */
export const registerPushToken = async (userId: string, token: string): Promise<void> => {
	const normalizedUserId = normalizeUserId(userId);

	await prisma.pushToken.upsert({
		where: { token },
		create: { userId: normalizedUserId, token },
		update: { userId: normalizedUserId }
	});
};

export const removePushToken = async (userId: string, token: string): Promise<void> => {
	await prisma.pushToken.deleteMany({ where: { userId: normalizeUserId(userId), token } });
};

export const getPushTokensForUser = async (userId: string): Promise<string[]> => {
	const rows = await prisma.pushToken.findMany({
		where: { userId: normalizeUserId(userId) },
		select: { token: true }
	});

	return rows.map(row => row.token);
};
