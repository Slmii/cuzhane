import prisma from '@db/prisma';
import type { UpdateUserSettingsBody } from '@schemas/userSettings.schema';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { UserSettings } from '../generated/prisma/client';

/**
 * The row as the client's `UserSettings` expects it — as stored. It used to map a retired reader
 * face (`madinah`) to the default on the way out; that face is gone from the enum itself now,
 * so every stored value is one the client knows.
 */
const serializeSettings = (settings: UserSettings) => settings;

export const getUserSettingsForUser = async (userId: string) => {
	const normalizedUserId = normalizeUserId(userId);

	const settings = await prisma.userSettings.upsert({
		where: { userId: normalizedUserId },
		update: {},
		create: { userId: normalizedUserId }
	});

	return serializeSettings(settings);
};

export const updateUserSettingsForUser = async (userId: string, input: UpdateUserSettingsBody) => {
	const normalizedUserId = normalizeUserId(userId);

	const updateData = {
		...(input.language !== undefined ? { language: input.language } : {}),
		...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
		...(input.cevsenGroupReadsEnabled !== undefined
			? { cevsenGroupReadsEnabled: input.cevsenGroupReadsEnabled }
			: {}),
		...(input.cevsenRoundCompleteEnabled !== undefined
			? { cevsenRoundCompleteEnabled: input.cevsenRoundCompleteEnabled }
			: {}),
		...(input.cevsenPoolClaimEnabled !== undefined ? { cevsenPoolClaimEnabled: input.cevsenPoolClaimEnabled } : {}),
		...(input.hatimGroupReadsEnabled !== undefined ? { hatimGroupReadsEnabled: input.hatimGroupReadsEnabled } : {}),
		...(input.hatimRoundCompleteEnabled !== undefined
			? { hatimRoundCompleteEnabled: input.hatimRoundCompleteEnabled }
			: {}),
		...(input.hatimPoolClaimEnabled !== undefined ? { hatimPoolClaimEnabled: input.hatimPoolClaimEnabled } : {}),
		...(input.memberJoinedEnabled !== undefined ? { memberJoinedEnabled: input.memberJoinedEnabled } : {}),
		...(input.memberLeftEnabled !== undefined ? { memberLeftEnabled: input.memberLeftEnabled } : {}),
		...(input.reminderTime !== undefined ? { reminderTime: input.reminderTime } : {}),
		...(input.hasSeenOnboarding !== undefined ? { hasSeenOnboarding: input.hasSeenOnboarding } : {}),
		...(input.hasSeenTour !== undefined ? { hasSeenTour: input.hasSeenTour } : {}),
		...(input.readerFontSize !== undefined ? { readerFontSize: input.readerFontSize } : {}),
		...(input.readerNumerals !== undefined ? { readerNumerals: input.readerNumerals } : {}),
		...(input.readerArabicFont !== undefined ? { readerArabicFont: input.readerArabicFont } : {})
	};

	if (Object.keys(updateData).length === 0) {
		return getUserSettingsForUser(normalizedUserId);
	}

	const settings = await prisma.userSettings.upsert({
		where: { userId: normalizedUserId },
		update: updateData,
		create: { userId: normalizedUserId, ...updateData }
	});

	return serializeSettings(settings);
};
