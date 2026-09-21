import type { HizbBlock } from '@/lib/content/hizbulhakaik';
import type { ReaderArabicFont, ReaderNumerals } from '@/lib/types/domain';

export interface HizbBodyProps {
	block: HizbBlock;
	/**
	 * The block is a bab of the Cevşen-ül Kebir, whose last line is the sübhâneke refrain and
	 * is set in red as the Cevşen reader sets it. Nothing else in the Hizb has a refrain.
	 */
	isCevsenBab: boolean;
	font: ReaderArabicFont;
	/** The reader's chosen size in points, before the per-face scale is applied. */
	fontSize: number;
	numerals: ReaderNumerals;
}
