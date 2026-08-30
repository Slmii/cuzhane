import type { ReaderNumerals } from '@/lib/types/domain';
import { BAB_COUNT } from '@/lib/utils/babs';
import cevsenData from './cevsen.data.json';

export type CevsenInvocation = {
	/** Its number in the printed ornament, 1-based within the bab. */
	n: number;
	text: string;
	/**
	 * The Turkish meal, from the same edition's *Mealli Cevşen*.
	 *
	 * **Turkish only, and optional on purpose.** There is no English meal in that source —
	 * its translated editions are `tr`, `es`, `oz` and `uz` — and one invocation (bab 44's
	 * ninth) is missing even in Turkish, because the two files of the same edition disagree
	 * about that line. The reader says so rather than inventing one.
	 */
	tr?: string;
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
	bismillah: string;
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

/**
 * The besmele that opens the work.
 *
 * The source sets it **once**, as bab 1's second line, not before each bab — so the reader
 * shows it on bab 1 alone. It was empty for a long time because the PDF this text used to
 * come from never set it apart from the running text.
 */
export const BISMILLAH = data.bismillah;

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

/** `U+06DD`, ARABIC END OF AYAH — the mark the chosen typeface draws around the number. */
const END_OF_AYAH = '۝';

/**
 * A verse mark as the font sets it: the character, then the digits it encloses.
 *
 * **It is a character, not a picture, and that is the whole point.** `ui/Ornament` draws the
 * design's rosette beautifully, but React Native cannot place it *inside* right-to-left text:
 * the advance the line reserves and the frame the view is painted at disagree, so rosettes
 * land on top of words with gaps where their boxes were. It looks font-specific and isn't —
 * measured across three faces, every one broke on some babs and not others, purely on how
 * that line's runs happened to reorder. The iOS system fallback never did, which is why this
 * only appeared once the reader was given a real Arabic font.
 *
 * `U+06DD` is what a printed mushaf uses and what every Arabic face draws for itself, so it
 * shapes and wraps with the words and cannot be misplaced. The cost is that the mark now
 * belongs to the chosen typeface rather than to the design system, so it differs a little in
 * each. It costs nothing else: all three faces enclose the digits, and all three do it for
 * Latin `1` as readily as Arabic-Indic `١`, so the numerals setting survived intact.
 *
 * **A new face must be checked for this, and coverage is not the test** — enclosing is a
 * shaping decision made across the mark *and* its digits, so a face can carry `U+06DD` and
 * still strand the number beside a hollow ring, as Hüsrev Hattı did. See `ornamentFaceFor`,
 * which is where the faces that decline are named.
 *
 * `ui/Ornament` is still the right thing wherever a `View` is legal — the meal sheet heads
 * itself with one. It no longer opens each bab: that mark was removed once the header carried
 * the number, the ownership chip and the tick strip between them.
 */
export const ayahMark = (n: number, numerals: ReaderNumerals = 'arabic') =>
	`${END_OF_AYAH}${toOrnamentDigits(n, numerals)}`;

/**
 * The reader's size range, in points.
 *
 * Was three presets — 19 / 23 / 28 — behind Küçük · Orta · Büyük. The sheet offers a slider
 * now, so the setting stores the size itself and these are only its ends. 23 remains the
 * default because it was the middle preset.
 */
export const READER_FONT_SIZE_MIN = 16;
export const READER_FONT_SIZE_MAX = 40;
export const READER_FONT_SIZE_DEFAULT = 23;

export const clampReaderFontSize = (size: number) =>
	Math.round(Math.min(READER_FONT_SIZE_MAX, Math.max(READER_FONT_SIZE_MIN, size)));
