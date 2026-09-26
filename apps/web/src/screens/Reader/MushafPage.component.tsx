import { Typography } from '@/components/ui/Typography/Typography.component';
import { ayahMark } from '@/lib/content/cevsen';
import {
	cuzPages,
	isVerseEnd,
	pageWordVerses,
	type QuranLine,
	type QuranPage,
	type QuranVerseEnd,
	type QuranWord,
	type QuranWordItem,
	SAJDAH_SIGN,
	SAJDAH_VERSE_KEYS,
	wordText
} from '@/lib/content/quran';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReaderNumerals, ReaderTextFont } from '@/lib/types/domain';
import { suraInfo } from '@/lib/content/sura';
import { fitsOnLines, flowRows, type RowAlignment, rowBands } from '@/screens/Reader/mushafLayout';
import { isDivineName, readerFaces } from '@/screens/Reader/ReaderBody.component';
import { SuraHeader } from '@/screens/Reader/SuraHeader.component';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

type Faces = ReturnType<typeof readerFaces>;

type MushafPageProps = {
	page: QuranPage;
	font: ReaderTextFont;
	faces: Faces;
	numerals: ReaderNumerals;
	/** A sura's name in the interface language, for the header over its first line. */
	suraName: (chapter: number) => string;
	/** A word or mark of a verse was long-pressed — `"53:62"`. The reader opens its meal. */
	onLongPressVerse?: (verseKey: string) => void;
	/** The verse whose meal is open, banded in `verseSelection` until the sheet closes. */
	selectedVerseKey?: string | null;
};

/**
 * A word or ayah mark, addressed by its line and place in it — the key its width is kept under —
 * and whether it belongs to a sajdah verse, which is washed in gilt.
 */
type Placed = { key: string; word: QuranWord; verseKey: string; isSajdah: boolean };
/** The words from one sura heading to the next, flowed together when the lines are let go. */
type Run = { sura: number | undefined; items: Placed[] };

/** The first two pages of the mushaf are set centred, as a frame, not to the full measure. */
const CENTRED_PAGES = new Set([1, 2]);
/** The least room between two words, as a fraction of the size — about a space. */
const WORD_GAP_EM = 0.28;
/**
 * A band's corners and how far it stands in from the row's top and bottom, so the bands of two
 * lines read as two, as the design draws the sajdah verse ("Secde âyeti", 10 and a gap). The
 * long-pressed verse's band is the same shape in another colour.
 */
const BAND_RADIUS = 10;
const BAND_INSET = 2;
/** The measuring layer is laid out this wide, so no word is clamped before it has been measured. */
const MEASURE_WIDTH = 10000;
/**
 * Held back from the column when breaking rows. The widths are the measuring pass's, to a
 * fraction of a point, and a row filled to the last hair could come out a hair wider on screen.
 */
const ROUNDING_SLACK = 1;

/**
 * **The basmala, from the text itself.** It is Al-Fātiḥa's first ayah, and the mushaf sets it
 * above every other sura that opens with it — so it is taken from the bundle, where it is real,
 * rather than typed here: the words of 1:1, up to its end.
 */
const BASMALA: QuranWordItem[] = (() => {
	const words = cuzPages(1)[0]?.lines.flatMap(line => line.w) ?? [];
	const end = words.findIndex(isVerseEnd);

	return words.slice(0, end === -1 ? 0 : end) as QuranWordItem[];
})();

/**
 * **Red, as the Cevşen reader sets them**: the basmala in full — the line above a sura and 1:1
 * itself, which are the same words — and the divine name wherever a whole word is the name
 * (`isDivineName`, the one rule both readers use). A word that carries a pause mark after the
 * name ("ٱللَّهِ ۖ") has the name coloured and the mark left as it is.
 */
const BASMALA_WORDS = new Set<QuranWord>(BASMALA);
/** Where a pause mark is joined to its word — see `wordText`. */
const NO_BREAK_SPACE = '\u00A0';

const opensSura = (line: QuranLine): number | undefined =>
	line.w.find((word): word is QuranWordItem => !isVerseEnd(word) && word.s !== undefined)?.s;

/**
 * One page of the mushaf — Q5's page body — drawn **word by word, never as a justified
 * paragraph**. It used to be one right-to-left paragraph with `textAlign: 'justify'`, and iOS's
 * justification shifts the marks on the last word of a stretched line: 27:82's أَنَّ lost its
 * shadda-with-fatha, and so did the last word of line after line. Here each word is its own
 * text, shaped exactly as the font draws it, and rows are spread by layout (`space-between`),
 * which is how quran.com fills the width.
 *
 * **Printed lines while they fit, flowed rows once they don't.** On a phone a mushaf line only
 * fits at about 17pt — measured across all 8,816 full lines, the widest on a typical page stops
 * fitting between 17 and 18 in every face — and the reader's default is 23. Scaling a page down
 * to its widest line made every size above that threshold render identically, so the size
 * setting did nothing. Now the chosen size is always the size drawn: a page whose lines all fit
 * keeps them, one line to a row; any other page pours its words into rows of its own, broken
 * here (`flowRows`) rather than by the text engine, starting afresh at every sura heading.
 *
 * **Two passes, because the widths are needed before the rows.** Every word is measured at the
 * chosen size in an invisible layer first, once per page, face and size; the page is drawn when
 * the last width arrives.
 *
 * A line cut by a cüz boundary (`partial`) holds only part of a printed line and keeps to the
 * right, as does the last row before a heading or the page's end; pages 1 and 2 are centred,
 * as the mushaf frames them.
 */
export const MushafPage = ({
	faces,
	font,
	numerals,
	onLongPressVerse,
	page,
	selectedVerseKey,
	suraName
}: MushafPageProps) => {
	const { theme } = useThemeContext();
	const [width, setWidth] = useState(0);
	const [measured, setMeasured] = useState<{ key: string; widths: Map<string, number> } | null>(null);
	const widthsRef = useRef<{ key: string; widths: Map<string, number> }>({ key: '', widths: new Map() });

	const key = `${page.page}|${font}|${faces.arabicFontSize}`;
	const isCentred = CENTRED_PAGES.has(page.page);
	const gap = faces.arabicFontSize * WORD_GAP_EM;
	const wordVerses = pageWordVerses(page);
	const lines: Placed[][] = page.lines.map((line, lineIndex) =>
		line.w.map((word, index) => {
			const verseKey = wordVerses[lineIndex]?.[index] ?? '';

			return { isSajdah: SAJDAH_VERSE_KEYS.has(verseKey), key: `${line.n}-${index}`, verseKey, word };
		})
	);
	const itemCount = lines.reduce((count, line) => count + line.length, 0);

	const handleMeasure = (itemKey: string, event: LayoutChangeEvent) => {
		if (widthsRef.current.key !== key) {
			widthsRef.current = { key, widths: new Map() };
		}

		widthsRef.current.widths.set(itemKey, event.nativeEvent.layout.width);

		if (widthsRef.current.widths.size === itemCount) {
			setMeasured({ key, widths: new Map(widthsRef.current.widths) });
		}
	};

	/** The face, size and line height every nested span re-declares — see the name's note below. */
	const spanStyle = {
		fontFamily: faces.arabicFont,
		fontSize: faces.arabicFontSize,
		lineHeight: faces.baseFontSize * 2
	};

	/**
	 * A word's text, with the basmala and the divine name in the page's red, and a sajdah
	 * verse's ۩ in the gilt its band is washed in — the design's ornament colour for it.
	 */
	const wordContent = (word: QuranWordItem, isSajdah: boolean) => {
		const text = wordText(word);
		const signAt = isSajdah ? text.indexOf(SAJDAH_SIGN) : -1;

		if (signAt !== -1) {
			return {
				color: undefined,
				content: [
					text.slice(0, signAt),
					<Typography color={theme.colors.gilt} key='sajdah' style={spanStyle}>
						{SAJDAH_SIGN}
					</Typography>,
					text.slice(signAt + SAJDAH_SIGN.length)
				]
			};
		}

		const markAt = text.indexOf(NO_BREAK_SPACE);
		const name = markAt === -1 ? text : text.slice(0, markAt);

		if (BASMALA_WORDS.has(word) || (markAt === -1 && isDivineName(text))) {
			return { color: theme.colors.danger, content: text };
		}

		if (markAt !== -1 && isDivineName(name)) {
			return {
				color: undefined,
				content: [
					/*
					 * The nested text re-declares the face and size, or its own variant's size wins —
					 * **and the line height**. iOS takes a paragraph's line spacing from its first
					 * character, which here is the name, so the variant's 21pt became the whole word's
					 * line and cut the lams of "ٱللَّهِ ۚ" off at the top (58:22, "حِزْبُ ٱللَّهِ ۚ").
					 */
					<Typography color={theme.colors.danger} key='name' style={spanStyle}>
						{name}
					</Typography>,
					text.slice(markAt)
				]
			};
		}

		return { color: undefined, content: text };
	};

	/*
	 * `onLongPress` opens the verse's meal. Only the words on the page take it — not the measuring
	 * layer, and not the basmala over a sura, which is 1:1's words set as a heading, not a verse
	 * of this sura. `suppressHighlighting` keeps iOS from greying a word while it is held.
	 */
	const renderWord = (word: QuranWord, reactKey: string, isSajdah = false, onLongPress?: () => void) => {
		if (isVerseEnd(word)) {
			return renderVerseEnd(word, reactKey, isSajdah, onLongPress);
		}

		const { color, content } = wordContent(word, isSajdah);

		return (
			<Typography
				{...(color ? { color } : {})}
				{...(onLongPress ? { onLongPress, suppressHighlighting: true } : {})}
				key={reactKey}
				numberOfLines={1}
				style={{
					fontFamily: faces.arabicFont,
					fontSize: faces.arabicFontSize,
					lineHeight: faces.baseFontSize * 2,
					writingDirection: 'rtl'
				}}
			>
				{content}
			</Typography>
		);
	};

	// A sajdah verse's mark in the darker gilt of its band; every other in the page's sage.
	const renderVerseEnd = (word: QuranVerseEnd, reactKey: string, isSajdah: boolean, onLongPress?: () => void) => (
		<Typography
			color={isSajdah ? theme.colors.gilt : theme.colors.accent}
			{...(onLongPress ? { onLongPress, suppressHighlighting: true } : {})}
			key={reactKey}
			numberOfLines={1}
			// The words' own line height. The Cevşen reader's mark inherits it from the verse it
			// sits in; standing alone here it took Typography's default, a line shorter than the
			// rosette, and the top of the ornament was clipped.
			style={{
				fontFamily: faces.ornamentFont,
				fontSize: faces.ornamentFontSize,
				lineHeight: faces.baseFontSize * 2
			}}
		>
			{ayahMark(word.e, numerals)}
		</Typography>
	);

	const renderSuraHeader = (sura: number) => (
		<View style={styles.suraHeader}>
			<SuraHeader font={font} name={suraName(sura)} sura={sura} />
			{/* The data says which suras open with it: all but Al-Fātiḥa, whose basmala is its
			    first ayah, and At-Tawba, which has none. */}
			{suraInfo(sura)?.bismillahPre === false ? null : (
				// Wraps rather than overflowing: at the largest sizes the basmala is wider than the column.
				<View style={[styles.row, styles.centred, styles.wrap, { gap }]}>
					{BASMALA.map((word, index) => renderWord(word, String(index)))}
				</View>
			)}
		</View>
	);

	/*
	 * A row, and behind any stretch of a sajdah verse on it the design's gilt band. The band is
	 * placed by `rowBands` from the measured widths and the row's alignment — the same rules the
	 * row lays itself out by — so it sits under exactly those words, drawn first so it is behind.
	 */
	const renderRow = (
		items: Placed[],
		alignment: RowAlignment,
		reactKey: string,
		widthOf: (item: Placed) => number
	) => {
		// Bands behind the words `isIn` picks out, in one colour — the same arithmetic for both kinds.
		const bandsFor = (isIn: (item: Placed) => boolean, color: string, kind: string) =>
			items.some(isIn)
				? rowBands(items.map(widthOf), items.map(isIn), width, gap, alignment).map(band => (
						<View
							key={`${kind}-${band.left}`}
							style={[
								styles.band,
								{ backgroundColor: color, left: band.left, width: band.right - band.left }
							]}
						/>
				  ))
				: null;

		return (
			<View key={reactKey} style={[styles.row, ALIGNMENT_STYLES[alignment], { gap }]}>
				{bandsFor(item => item.isSajdah, theme.colors.giltSoft, 'sajdah')}
				{/* The long-pressed verse, over the gilt when it is a sajdah verse so both still show. */}
				{selectedVerseKey
					? bandsFor(item => item.verseKey === selectedVerseKey, theme.colors.verseSelection, 'selected')
					: null}
				{items.map(item =>
					renderWord(
						item.word,
						item.key,
						item.isSajdah,
						onLongPressVerse && item.verseKey ? () => onLongPressVerse(item.verseKey) : undefined
					)
				)}
			</View>
		);
	};

	const renderPage = (widths: Map<string, number>) => {
		const widthOf = (item: Placed) => widths.get(item.key) ?? 0;
		const available = width - ROUNDING_SLACK;

		if (fitsOnLines(lines, available, gap, widthOf)) {
			return page.lines.map((line, index) => {
				const sura = opensSura(line);

				return (
					<View key={line.n}>
						{sura === undefined ? null : renderSuraHeader(sura)}
						{renderRow(
							lines[index] ?? [],
							isCentred ? 'centred' : line.partial ? 'start' : 'spread',
							'line',
							widthOf
						)}
					</View>
				);
			});
		}

		const runs: Run[] = [];

		page.lines.forEach((line, index) => {
			const sura = opensSura(line);
			const current = runs.at(-1);

			if (sura !== undefined || current === undefined) {
				runs.push({ items: [...(lines[index] ?? [])], sura });
			} else {
				current.items.push(...(lines[index] ?? []));
			}
		});

		return runs.map((run, runIndex) => {
			const rows = flowRows(run.items, available, gap, widthOf, item => isVerseEnd(item.word));

			return (
				<View key={runIndex}>
					{run.sura === undefined ? null : renderSuraHeader(run.sura)}
					{rows.map((row, rowIndex) =>
						renderRow(
							row,
							isCentred ? 'centred' : rowIndex === rows.length - 1 ? 'start' : 'spread',
							String(rowIndex),
							widthOf
						)
					)}
				</View>
			);
		});
	};

	return (
		<View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
			{/* The measuring pass: every word at the chosen size, natural width, unseen and unread. */}
			<View
				accessibilityElementsHidden
				importantForAccessibility='no-hide-descendants'
				pointerEvents='none'
				style={styles.measureLayer}
			>
				{lines.flatMap(line =>
					line.map(item => (
						<View
							key={`${key}-${item.key}`}
							onLayout={event => handleMeasure(item.key, event)}
							style={styles.measureItem}
						>
							{renderWord(item.word, item.key, item.isSajdah)}
						</View>
					))
				)}
			</View>

			{measured?.key === key && width > 0 ? renderPage(measured.widths) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	centred: {
		justifyContent: 'center'
	},
	// Laid out side by side and wrapping, so the unseen layer stays short however many words.
	measureItem: {
		alignSelf: 'flex-start'
	},
	measureLayer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		left: 0,
		opacity: 0,
		position: 'absolute',
		top: 0,
		width: MEASURE_WIDTH
	},
	// Right to left: the first word of a row sits at the right edge.
	row: {
		alignItems: 'baseline',
		flexDirection: 'row-reverse'
	},
	band: {
		borderRadius: BAND_RADIUS,
		bottom: BAND_INSET,
		position: 'absolute',
		top: BAND_INSET
	},
	spread: {
		justifyContent: 'space-between'
	},
	start: {
		justifyContent: 'flex-start'
	},
	suraHeader: {
		gap: 10,
		marginBottom: 8,
		marginTop: 14
	},
	wrap: {
		flexWrap: 'wrap'
	}
});

/** A row's alignment by name, so the same name can place its sajdah band — see `rowBands`. */
const ALIGNMENT_STYLES: Record<RowAlignment, (typeof styles)[keyof typeof styles]> = {
	centred: styles.centred,
	spread: styles.spread,
	start: styles.start
};
