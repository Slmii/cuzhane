import type { HizbBlock } from '@/lib/content/hizbulhakaik';
import type { ReaderArabicFont, ReaderNumerals } from '@/lib/types/domain';

export type IstighfarProgress = {
	sessionOnly?: boolean;
	count: number;
	target: number;
	disabled: boolean;
	onChange: (patch: { istighfarRepetitions?: number; istighfarTarget?: number }) => void;
};
/** A fixed-target count: the Delâil salavat's 3, Sekine's 19. */
export type RepetitionProgress = {
	count: number;
	disabled: boolean;
	sessionOnly?: boolean;
	onChange: (count: number) => void;
};
export type DelailProgress = RepetitionProgress;
export interface HizbBodyProps {
	delailProgress?: DelailProgress;
	/** Given on a Sekine page: the whole page is the repeated text. */
	sekineProgress?: RepetitionProgress;
	istighfarProgress?: IstighfarProgress;
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
