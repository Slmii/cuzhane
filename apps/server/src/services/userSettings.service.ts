import prisma from '@db/prisma';
import type { UpdateUserSettingsBody } from '@schemas/userSettings.schema';
import { normalizeUserId } from '@utils/normalizeUserId';

export const getUserSettingsForUser = async (userId: string) => {
	const normalizedUserId = normalizeUserId(userId);

	return prisma.userSettings.upsert({
		where: { userId: normalizedUserId },
		update: {},
		create: { userId: normalizedUserId }
	});
};

export const updateUserSettingsForUser = async (userId: string, input: UpdateUserSettingsBody) => {
	const normalizedUserId = normalizeUserId(userId);

	const updateData = {
		...(input.language !== undefined ? { language: input.language } : {}),
		...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
		...(input.reminderTime !== undefined ? { reminderTime: input.reminderTime } : {}),
		...(input.hasSeenOnboarding !== undefined ? { hasSeenOnboarding: input.hasSeenOnboarding } : {}),
		...(input.readerFontScale !== undefined ? { readerFontScale: input.readerFontScale } : {}),
		...(input.readerNumerals !== undefined ? { readerNumerals: input.readerNumerals } : {}),
		...(input.readerArabicFont !== undefined ? { readerArabicFont: input.readerArabicFont } : {})
	};

	if (Object.keys(updateData).length === 0) {
		return getUserSettingsForUser(normalizedUserId);
	}

	return prisma.userSettings.upsert({
		where: { userId: normalizedUserId },
		update: updateData,
		create: { userId: normalizedUserId, ...updateData }
	});
};
