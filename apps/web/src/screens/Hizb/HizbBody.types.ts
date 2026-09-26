import type { HizbBlock } from '@/lib/content/hizbulhakaik';
import type { ReaderArabicFont, ReaderNumerals } from '@/lib/types/domain';

export type IstighfarProgress = {
	sessionOnly?: boolean;
	count: number;
	target: number;
	disabled: boolean;
	onChange: (patch: { istighfarRepetitions?: number; istighfarTarget?: number }) => void;
};
export type DelailProgress = {
	count: number;
	disabled: boolean;
	sessionOnly?: boolean;
	onChange: (count: number) => void;
};
export interface HizbBodyProps {
	delailProgress?: DelailProgress;
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
