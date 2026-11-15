import type { ReaderNumerals } from '@/lib/types/domain';

export type VerseMealSheetProps = {
	/** The verse long-pressed, `"53:62"`, or `null` when the sheet is closed. */
	verseKey: string | null;
	onClose: () => void;
	/** The reader's face and its corrected size, so the verse in the sheet matches the page. */
	arabicFont: string;
	arabicFontSize: number;
	numerals: ReaderNumerals;
};
