import prisma from '@db/prisma';
import type { UpdateUserSettingsBody } from '@schemas/userSettings.schema';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { UserSettings } from '../generated/prisma/client';

/**
 * The row as the client's `UserSettings` expects it — as stored, plus the three Cevşen switches
 * under their **1.2.0 names**. That build reads and writes `groupReadsEnabled`,
 * `roundCompleteEnabled` and `poolClaimEnabled`; without them it showed all three off and could
 * not change them. Same columns, old names — drop once no 1.2.0 install is left.
 */
const serializeSettings = (settings: UserSettings) => ({
	...settings,
	groupReadsEnabled: settings.cevsenGroupReadsEnabled,
	poolClaimEnabled: settings.cevsenPoolClaimEnabled,
	roundCompleteEnabled: settings.cevsenRoundCompleteEnabled
});

/** A 1.2.0 name stands in for its Cevşen column when the new name is not sent too. */
const cevsenSwitch = (current: boolean | undefined, legacy: boolean | undefined) => current ?? legacy;

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

	const cevsenGroupReadsEnabled = cevsenSwitch(input.cevsenGroupReadsEnabled, input.groupReadsEnabled);
	const cevsenRoundCompleteEnabled = cevsenSwitch(input.cevsenRoundCompleteEnabled, input.roundCompleteEnabled);
	const cevsenPoolClaimEnabled = cevsenSwitch(input.cevsenPoolClaimEnabled, input.poolClaimEnabled);

	const updateData = {
		...(input.language !== undefined ? { language: input.language } : {}),
		...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
		...(cevsenGroupReadsEnabled !== undefined ? { cevsenGroupReadsEnabled } : {}),
		...(cevsenRoundCompleteEnabled !== undefined ? { cevsenRoundCompleteEnabled } : {}),
		...(cevsenPoolClaimEnabled !== undefined ? { cevsenPoolClaimEnabled } : {}),
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
