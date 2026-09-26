import type { CevsenInvocation } from '@/lib/content/cevsen';
import type { ReaderNumerals, ReaderTextFont } from '@/lib/types/domain';

export interface ReaderBodyProps {
	/** 1–100. Bab 1 carries the besmele, bab 100 the du'a that follows it. */
	babNumber: number;
	font: ReaderTextFont;
	/** The reader's chosen size in points, before the per-face scale is applied. */
	fontSize: number;
	numerals: ReaderNumerals;
	/**
	 * A verse mark was long-pressed. Both readers open `MealSheet` with it; the mark is the
	 * only pressable thing in the text, for the reasons spelled out in the component.
	 */
	onLongPressInvocation: (invocation: CevsenInvocation) => void;
}
