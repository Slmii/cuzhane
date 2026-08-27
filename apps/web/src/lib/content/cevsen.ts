import { BAB_COUNT } from '@/lib/utils/babs';

export type CevsenBab = {
	number: number;
	/** Arabic body of the bab, RTL. Empty until the text is supplied. */
	arabic: string;
};

/**
 * The Cevşen text itself is not bundled yet — the design mocks it with placeholder
 * rules, and shipping an inaccurate religious text is worse than shipping none.
 * The reader renders `readerMissing` for any bab whose `arabic` is empty, so
 * dropping the real text in here is the only change needed to light it up.
 */
export const CEVSEN_BABS: CevsenBab[] = Array.from({ length: BAB_COUNT }, (_, index) => ({
	number: index + 1,
	arabic: ''
}));

/** Recited before each bab. Empty for the same reason as the bab bodies. */
export const BISMILLAH = '';

export const getBab = (babNumber: number): CevsenBab | undefined => CEVSEN_BABS.find(bab => bab.number === babNumber);

export const READER_FONT_SIZES = [26, 32, 40] as const;

export const readerFontSize = (scale: number) =>
	READER_FONT_SIZES[Math.max(0, Math.min(READER_FONT_SIZES.length - 1, scale))] ?? READER_FONT_SIZES[0];
