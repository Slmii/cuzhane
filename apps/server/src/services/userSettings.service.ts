import prisma from '@db/prisma';
import type { UpdateUserSettingsBody } from '@schemas/userSettings.schema';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { UserSettings } from '../generated/prisma/client';

/**
 * `madinah` is retired but still a value in the database enum, so a row written before it went
 * can still carry it — exactly the situation `toSplitMode` handles for `FREE`.
 *
 * It went because of one mark: that face drew the subscript alef, the edition's own long î and
 * 549 of them across seventy babs, more than twice as wide as it is tall. `uthman` is the face
 * that replaced it and the reader's default, so it is the honest reading of such a row.
 */
export const toReaderArabicFont = (font: UserSettings['readerArabicFont']) =>
	font === 'naskh' || font === 'amiri' ? font : 'uthman';

/** The row as the client's `UserSettings` expects it — see `toReaderArabicFont`. */
const serializeSettings = (settings: UserSettings) => ({
	...settings,
	readerArabicFont: toReaderArabicFont(settings.readerArabicFont)
});

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
		...(input.groupReadsEnabled !== undefined ? { groupReadsEnabled: input.groupReadsEnabled } : {}),
		...(input.roundCompleteEnabled !== undefined ? { roundCompleteEnabled: input.roundCompleteEnabled } : {}),
		...(input.poolClaimEnabled !== undefined ? { poolClaimEnabled: input.poolClaimEnabled } : {}),
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
