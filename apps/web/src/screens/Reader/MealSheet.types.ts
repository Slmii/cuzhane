import type { CevsenInvocation } from '@/lib/content/cevsen';
import type { ReaderNumerals } from '@/lib/types/domain';

export type MealSheetProps = {
	babNumber: number;
	/** The invocation being read, or `null` when the sheet is closed. */
	invocation: CevsenInvocation | null;
	onClose: () => void;
	/**
	 * The invocation's Arabic **already corrected for the chosen face** — the sheet must not
	 * reach for `invocation.text` itself. It showed the raw string at first, which put
	 * KFGQPC's spacing `U+06EA` disc back in the middle of the line on the one surface that
	 * had escaped the reader's fix.
	 */
	arabicText: string;
	/** The reader's chosen Arabic face and its corrected size, so the sample matches the page. */
	arabicFont: string;
	arabicFontSize: number;
	/** Which digits the rosette shows, matching the reader's setting. */
	numerals: ReaderNumerals;
};
