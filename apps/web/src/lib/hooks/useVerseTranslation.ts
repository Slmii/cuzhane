import { getVerseTranslation } from '@/api/quran.api';
import { quranQueryKeys } from '@/lib/hooks/queryKeys';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useQuery } from '@tanstack/react-query';

/**
 * A verse's meal in the interface language, **fetched when the verse is long-pressed** and
 * never bundled. Idle while `verseKey` is `null` (the sheet closed); kept for the session once
 * fetched, because a meal does not change and a reader often presses the same verse twice.
 * One retry, not the client's default three: the sheet is open and waiting, and a meal that
 * failed twice is better answered with "Tekrar dene" than with seconds of spinner.
 */
export const useVerseTranslation = (verseKey: string | null) => {
	const { language } = useTranslation();

	return useQuery({
		enabled: verseKey !== null,
		queryFn: () => getVerseTranslation(verseKey ?? '', language),
		queryKey: quranQueryKeys.translation(verseKey ?? '', language),
		retry: 1,
		staleTime: Infinity
	});
};
