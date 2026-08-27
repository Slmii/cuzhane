import { wrapperApi } from '@/api/wrapper.api';
import { UserSettings } from '@/lib/types/domain';

export type UpdateUserSettingsInput = Partial<
	Pick<
		UserSettings,
		| 'language'
		| 'notificationsEnabled'
		| 'reminderEnabled'
		| 'reminderTime'
		| 'hasSeenOnboarding'
		| 'readerFontScale'
	>
>;

export const getUserSettings = async () => wrapperApi<UserSettings>('/user-settings', { method: 'GET' });

export const updateUserSettings = async (input: UpdateUserSettingsInput) =>
	wrapperApi<UserSettings>('/user-settings', {
		method: 'PATCH',
		body: JSON.stringify(input)
	});
