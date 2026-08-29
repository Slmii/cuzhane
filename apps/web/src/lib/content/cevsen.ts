import type { ReaderNumerals } from '@/lib/types/domain';
import { BAB_COUNT } from '@/lib/utils/babs';
import cevsenData from './cevsen.data.json';

export type CevsenInvocation = {
	/** Its number in the printed ornament, 1-based within the bab. */
	n: number;
	text: string;
};

export type CevsenBab = {
	number: number;
	invocations: CevsenInvocation[];
	/**
	 * The refrain every bab ends on, which the printed page sets in red, and the bab number
	 * that sits in its ornament.
	 */
	closing: CevsenInvocation;
	/**
	 * How the page breaks the bab across lines, as invocation numbers — `[[1,2],[3,4,5,6]]`.
	 * Advisory: the reader wraps to its own width and font, and only falls back to this when
	 * asked to mirror the print.
	 */
	rows: number[][];
};

type CevsenData = {
	babs: CevsenBab[];
	afterHundredth: string[];
};

const data = cevsenData as unknown as CevsenData;

/**
 * The hundred babs, extracted from the printed edition's text layer.
 *
 * Indexed by each entry's own `number` rather than array position, so a gap in the source
 * can't silently shift every bab by one.
 */
export const CEVSEN_BABS: CevsenBab[] = Array.from({ length: BAB_COUNT }, (_, index) => {
	const number = index + 1;

	return (
		data.babs.find(bab => bab.number === number) ?? {
			number,
			invocations: [],
			closing: { n: number, text: '' },
			rows: []
		}
	);
});

/**
 * The supplication the edition prints after the hundredth bab. Deliberately not a bab: the
 * app splits exactly 100 across a group, and a hundred-and-first would corrupt every share.
 */
export const CEVSEN_AFTER_HUNDREDTH: string[] = data.afterHundredth;

/** Recited before each bab. Not set apart in the source, so the reader omits it. */
export const BISMILLAH = '';

export const getBab = (babNumber: number): CevsenBab | undefined => CEVSEN_BABS.find(bab => bab.number === babNumber);

const EASTERN_ARABIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * The number inside a verse ornament.
 *
 * `arabic` gives ١, ٢, ٣ — what the printed page sets and the app's default. `latin` gives
 * 1, 2, 3, which E2a offers because the Arabic-Indic forms are unfamiliar to plenty of
 * readers who are perfectly comfortable with the Arabic text itself.
 *
 * This started as a build-time constant, flipped by hand, from when the ornament was a
 * plain circle small enough that ١ and ٢ read as a stray mark. It is a real setting now.
 */
export const toOrnamentDigits = (value: number, numerals: ReaderNumerals = 'arabic'): string =>
	numerals === 'latin'
		? String(value)
		: String(value)
				.split('')
				.map(digit => EASTERN_ARABIC[Number(digit)] ?? digit)
				.join('');

/**
 * Küçük · Orta · Büyük.
 *
 * Down from 26/32/40. Those were set when the reader broke a bab into one short centred
 * line per invocation, which left the column mostly empty and could carry the size; flowing
 * the whole bab as a paragraph fills it, and at 26 the smallest setting was no longer the
 * small one.
 */
export const READER_FONT_SIZES = [19, 23, 28] as const;

export const readerFontSize = (scale: number) =>
	READER_FONT_SIZES[Math.max(0, Math.min(READER_FONT_SIZES.length - 1, scale))] ?? READER_FONT_SIZES[0];
