import { wrapperApi } from '@/api/wrapper.api';
import type { AppLanguage } from '@/lib/i18n/strings';

/** Mirrors the server's `VerseTranslation` (`quranTranslation.service.ts`). */
export type VerseTranslation = {
	verseKey: string;
	language: AppLanguage;
	/** The meal, as plain text. */
	text: string;
	/** Who translated it — shown under the meal. */
	translator: string;
};

/** A verse's meal in the given language, fetched live by the server from the Quran Foundation. */
export const getVerseTranslation = async (verseKey: string, language: AppLanguage) =>
	wrapperApi<VerseTranslation>(
		`/quran/translation?verseKey=${encodeURIComponent(verseKey)}&lang=${encodeURIComponent(language)}`
	);
