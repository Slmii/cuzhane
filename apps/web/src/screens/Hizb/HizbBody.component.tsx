import { splitDelailRepetition } from '@/lib/content/hizbDelail';
import { DelailReading } from './DelailReading.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { ayahMark } from '@/lib/content/cevsen';
import { isBesmele, type HizbLine } from '@/lib/content/hizbulhakaik';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { textFontFor, type ReaderNumerals } from '@/lib/types/domain';
import { readerFaces, withDivineName } from '@/screens/Reader/ReaderBody.component';
import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { splitIstighfar } from '@/lib/content/hizbIstighfar';
import { SEKINE_REPETITIONS, splitSekine } from '@/lib/content/hizbSekine';
import { IstighfarReading } from './IstighfarReading.component';
import { RepetitionBox, RepetitionTag } from '@/components/RepetitionBox/RepetitionBox.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { HizbBodyProps } from './HizbBody.types';

/** The print's mark between invocations. */
const INVOCATION_MARK = '❁';
/** `U+06DD` on its own — the rosette the verse marks are drawn in, with nothing inside it. */
const BARE_ORNAMENT = '۝';
/** A verse or bab number as the source sets it: Arabic-Indic digits between ornate parentheses. */
const VERSE_NUMBER = /^﴿([٠-٩]+)﴾$/u;
const TOKENS = /(﴿[٠-٩]+﴾|❁)/u;

const toLatinNumber = (digits: string) => Number([...digits].map(digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)).join(''));

type Faces = ReturnType<typeof readerFaces>;
/** What the text draws — never the progress props, which are new on every count. */
type HizbTextProps = Pick<HizbBodyProps, 'block' | 'font' | 'fontSize' | 'isCevsenBab' | 'numerals'>;

/**
 * A run of Arabic with its ornaments set the way `ReaderBody` sets the Cevşen's.
 *
 * The source carries two kinds of mark inline: `❁` between invocations, and `﴿N﴾` closing a
 * verse or a bab. Both become the same ornament face and colour the Cevşen reader uses — the
 * number rewritten through `ayahMark`, so the numerals setting applies here too, and the bare
 * mark as the rosette alone. The words around them get the divine name in red.
 */
const setArabic = (
	text: string,
	faces: Faces,
	color: string,
	ornamentColor: string,
	numerals: ReaderNumerals,
	/** The section's ❁ before this text (`HizbLine.marksBefore`); undefined leaves the marks bare. */
	marksBefore?: number
) => {
	let mark = marksBefore ?? 0;

	return text
		.split(TOKENS)
		.filter(Boolean)
		.map((part, index): ReactNode => {
			// Every nested span re-declares the paragraph's line — see `withDivineName` on why
			// Android clips a paragraph measured by a nested span's own 21pt line.
			const lineHeight = faces.baseFontSize * 2;
			const ornament = { fontFamily: faces.ornamentFont, fontSize: faces.ornamentFontSize, lineHeight };

			if (part === INVOCATION_MARK) {
				mark += 1;

				// Numbered within its section, in the reader's numerals — the Cevşen-ül Kebir's stay bare.
				return (
					<Typography color={ornamentColor} key={`mark-${index}`} style={ornament}>
						{marksBefore === undefined ? BARE_ORNAMENT : ayahMark(mark, numerals)}
					</Typography>
				);
			}

			const verse = VERSE_NUMBER.exec(part);

			if (verse) {
				return (
					<Typography color={ornamentColor} key={`verse-${index}`} style={ornament}>
						{ayahMark(toLatinNumber(verse[1]), numerals)}
					</Typography>
				);
			}

			return (
				<Fragment key={`text-${index}`}>
					{withDivineName(part, {
						color,
						fontFamily: faces.arabicFont,
						fontSize: faces.arabicFontSize,
						lineHeight
					})}
				</Fragment>
			);
		});
};

/**
 * One block of the Hizb as the Cevşen reader sets a bab: each besmele on its own line in red,
 * where the print has it, the text between them as flowing paragraphs, and — for the Cevşen's own
 * babs — the refrain in red on its own line. A section's opening name is not drawn.
 *
 * **Presentational, like `ReaderBody`.** It knows the block, the face, the size and the
 * numerals, and nothing about where in the Hizb it sits. The paragraph flows to this screen's
 * measure rather than to the print's line breaks, for the reason `ReaderBody` gives about the
 * du'a after the hundredth: those breaks belong to the page's width and type, not to ours.
 *
 * **`memo`'d, because the group's reader re-renders around it all the time** — every counter
 * tap, every poll of the group, every frame of a scrub across the strip — and each of those
 * would otherwise re-split the whole block and rebuild its runs of Arabic. Every prop is a
 * primitive or a block both readers hand over with a stable identity, so the shallow compare
 * holds until the page or the typography actually changes.
 */
const HizbBodyContent = memo(({ block, font, fontSize: chosenSize, isCevsenBab, numerals }: HizbTextProps) => {
	const { theme } = useThemeContext();
	// Hüsrev is page images, which the Hizb has none of — its text falls back like the Cevşen's.
	const faces = readerFaces(textFontFor(font), chosenSize);
	const arabic = {
		fontFamily: faces.arabicFont,
		fontSize: faces.arabicFontSize,
		lineHeight: faces.baseFontSize * 2,
		writingDirection: 'rtl' as const
	};

	const lines = block.lines;
	const closing = isCevsenBab && lines.length > 1 ? lines[lines.length - 1] : undefined;
	const body = (closing ? lines.slice(0, -1) : lines).filter(line => !line.isSectionName);
	// In the print's order: a besmele alone, the lines between besmeles as one paragraph each.
	const runs: HizbLine[][] = [];

	for (const line of body) {
		const last = runs.at(-1);

		if (isBesmele(line) || !last || isBesmele(last[0]!)) {
			runs.push([line]);
		} else {
			last.push(line);
		}
	}

	return (
		<>
			{runs.map(run =>
				isBesmele(run[0]!) ? (
					<Typography
						color={theme.colors.danger}
						key={`besmele-${lines.indexOf(run[0]!)}`}
						style={[styles.bismillah, arabic]}
						textAlign='center'
					>
						{run[0]!.text}
					</Typography>
				) : (
					<Typography
						key={`text-${lines.indexOf(run[0]!)}`}
						style={[styles.arabic, arabic]}
						textAlign='center'
					>
						{setArabic(
							run.map(line => line.text).join(' '),
							faces,
							theme.colors.danger,
							theme.colors.accent,
							numerals,
							// The run's lines follow on in the section, so its first line's count holds for all.
							run[0]!.marksBefore
						)}
					</Typography>
				)
			)}
			{closing ? (
				<Typography
					color={theme.colors.danger}
					style={[styles.arabic, styles.closing, arabic]}
					textAlign='center'
				>
					{setArabic(closing.text, faces, theme.colors.danger, theme.colors.danger, numerals)}
				</Typography>
			) : null}
		</>
	);
});

HizbBodyContent.displayName = 'HizbBodyContent';
/**
 * **Every count re-renders this, and none of it may reach the text.** A tap on a counter writes
 * the reading, and the reader hands over new progress objects — so the Arabic is given only what
 * it draws (never the progress props), and the blocks cut out of the page are made once per page.
 * Otherwise each tap re-typeset the whole page, and counting fast lagged.
 */
export const HizbBody = memo(
	({
		block,
		delailProgress,
		font,
		fontSize,
		isCevsenBab,
		istighfarProgress,
		numerals,
		sekineProgress
	}: HizbBodyProps) => {
		const { t } = useTranslation();
		const hasDelail = delailProgress !== undefined;
		const hasSekine = sekineProgress !== undefined;
		const cut = useMemo(() => {
			const sekine = hasSekine ? splitSekine(block) : null;
			const delail = hasDelail ? splitDelailRepetition(block) : null;
			const istighfar = delail ? null : splitIstighfar(block);

			return {
				delail,
				istighfar: istighfar
					? { introduction: istighfar.introduction, sentence: { lines: [istighfar.sentence] } }
					: null,
				sekine
			};
		}, [block, hasDelail, hasSekine]);
		const text = (shown: HizbTextProps['block']) => (
			<HizbBodyContent
				block={shown}
				font={font}
				fontSize={fontSize}
				isCevsenBab={isCevsenBab}
				numerals={numerals}
			/>
		);

		if (sekineProgress && cut.sekine) {
			// The book's own order: the takbirs once, the besmele onward nineteen times, then its
			// instruction — not recited, so it sits outside the box. The title is left out; the
			// reader's heading already names the section.
			return (
				<>
					<RepetitionTag label={t('hpOnceTag')} />
					{text(cut.sekine.opening)}
					<RepetitionBox
						count={sekineProgress.count}
						disabled={sekineProgress.disabled}
						max={SEKINE_REPETITIONS}
						onCountChange={sekineProgress.onChange}
						target={SEKINE_REPETITIONS}
					>
						{text(cut.sekine.repeated)}
					</RepetitionBox>
					{text(cut.sekine.instruction)}
				</>
			);
		}
		if (cut.delail && delailProgress) {
			return (
				<>
					<DelailReading progress={delailProgress}>{text(cut.delail.passage)}</DelailReading>
					{text(cut.delail.after)}
				</>
			);
		}
		if (!cut.istighfar) {
			return text(block);
		}
		return (
			<>
				{/* T1d: the tags say what the instructions paragraph used to — once, then repeated. */}
				<RepetitionTag label={t('hpOnceTag')} />
				{text(cut.istighfar.introduction)}
				<IstighfarReading progress={istighfarProgress}>{text(cut.istighfar.sentence)}</IstighfarReading>
			</>
		);
	}
);
HizbBody.displayName = 'HizbBody';

const styles = StyleSheet.create({
	arabic: {
		marginBottom: 22
	},
	bismillah: {
		marginBottom: 20
	},
	closing: {
		marginBottom: 0,
		marginTop: 4
	}
});
