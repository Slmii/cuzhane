import type { ReaderNumerals } from '@/lib/types/domain';
import type { ReactNode } from 'react';

/** The meal sheet's one layout, filled by the Cevşen (`MealSheet`) and the Kuran (`VerseMealSheet`). */
export type MealSheetViewProps = {
	isVisible: boolean;
	onClose: () => void;
	/** The number in the header's rosette — the invocation's or the ayah's. */
	number: number;
	/** The rosette's colour: the page's sage, or gilt for a sajdah verse, as its mark is on the page. */
	ornamentColor: string;
	numerals: ReaderNumerals;
	/** "Bab 12 · Ayet 3", "Necm · Ayet 62" — beside the rosette. */
	reference: string;
	arabicText: string;
	arabicFont: string;
	arabicFontSize: number;
	/** The meal itself, or `null` while there is none to show — `message` stands in for it. */
	meal: string | null;
	/** Said instead of the meal: why there is none, that it is loading, or that it failed. */
	message: string;
	/** Under the meal, muted — who translated it. */
	credit?: string;
	/** Under the card — the sajdah note, or a retry. */
	footer?: ReactNode;
};
