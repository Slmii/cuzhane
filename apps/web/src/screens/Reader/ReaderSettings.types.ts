import type { UpdateUserSettingsInput } from '@/api/userSettings.api';
import type { UserSettings } from '@/lib/types/domain';

export type ReaderSettingsProps = {
	settings: Pick<UserSettings, 'readerFontSize' | 'readerNumerals' | 'readerArabicFont'>;
	/** Offer Hüsrev hattı — the Kuran reader only, the one reader that has its page images. */
	hasMushafPages?: boolean;
	/**
	 * Persisted immediately, one field at a time. There is no Kaydet: every control shows
	 * its own result in the preview above, so the choice has already been made by the time
	 * you would have reached for a save button.
	 */
	onChange: (patch: UpdateUserSettingsInput) => void;
};
