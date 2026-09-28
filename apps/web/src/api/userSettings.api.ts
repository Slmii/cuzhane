import { wrapperApi } from '@/api/wrapper.api';
import { UserSettings } from '@/lib/types/domain';

export type UpdateUserSettingsInput = Partial<
	Pick<
		UserSettings,
		| 'language'
		| 'reminderEnabled'
		| 'reminderTime'
		| 'cevsenGroupReadsEnabled'
		| 'cevsenRoundCompleteEnabled'
		| 'cevsenPoolClaimEnabled'
		| 'hatimGroupReadsEnabled'
		| 'hatimRoundCompleteEnabled'
		| 'hatimPoolClaimEnabled'
		| 'memberJoinedEnabled'
		| 'memberLeftEnabled'
		| 'hasSeenOnboarding'
		| 'hasSeenTour'
		| 'cevsenIntroEnabled'
		| 'hatimIntroEnabled'
		| 'hizbIntroEnabled'
		| 'readerFontSize'
		| 'readerNumerals'
		| 'readerArabicFont'
	>
>;

export const getUserSettings = async () => wrapperApi<UserSettings>('/user-settings', { method: 'GET' });

export const updateUserSettings = async (input: UpdateUserSettingsInput) =>
	wrapperApi<UserSettings>('/user-settings', {
		method: 'PATCH',
		body: JSON.stringify(input)
	});
