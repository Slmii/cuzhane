import { splitDelailRepetition } from '@/lib/content/hizbDelail';
import { DelailReading } from './DelailReading.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { ayahMark, BISMILLAH } from '@/lib/content/cevsen';
import type { HizbLine } from '@/lib/content/hizbulhakaik';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReaderNumerals } from '@/lib/types/domain';
import { readerFaces, withDivineName } from '@/screens/Reader/ReaderBody.component';
import { Fragment, memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { splitIstighfar } from '@/lib/content/hizbIstighfar';
import { IstighfarReading } from './IstighfarReading.component';
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

/**
 * A run of Arabic with its ornaments set the way `ReaderBody` sets the Cevşen's.
 *
 * The source carries two kinds of mark inline: `❁` between invocations, and `﴿N﴾` closing a
 * verse or a bab. Both become the same ornament face and colour the Cevşen reader uses — the
 * number rewritten through `ayahMark`, so the numerals setting applies here too, and the bare
 * mark as the rosette alone. The words around them get the divine name in red.
 */
const setArabic = (text: string, faces: Faces, color: string, ornamentColor: string, numerals: ReaderNumerals) =>
	text
		.split(TOKENS)
		.filter(Boolean)
		.map((part, index): ReactNode => {
			const ornament = { fontFamily: faces.ornamentFont, fontSize: faces.ornamentFontSize };

			if (part === INVOCATION_MARK) {
				return (
					<Typography color={ornamentColor} key={`mark-${index}`} style={ornament}>
						{BARE_ORNAMENT}
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
					{withDivineName(part, { color, fontFamily: faces.arabicFont, fontSize: faces.arabicFontSize })}
				</Fragment>
			);
		});

/**
 * One block of the Hizb as the Cevşen reader sets a bab: the besmele in red where the print
 * has one, the text as one flowing paragraph, and — for the Cevşen's own babs — the refrain in
 * red on its own line.
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
const HizbBodyContent = memo(({ block, font, fontSize: chosenSize, isCevsenBab, numerals }: HizbBodyProps) => {
	const { theme } = useThemeContext();
	const faces = readerFaces(font, chosenSize);
	const arabic = {
		fontFamily: faces.arabicFont,
		fontSize: faces.arabicFontSize,
		lineHeight: faces.baseFontSize * 2,
		writingDirection: 'rtl' as const
	};

	const isBismillah = (line: HizbLine) => line.text === BISMILLAH;
	const lines = block.lines;
	const closing = isCevsenBab && lines.length > 1 ? lines[lines.length - 1] : undefined;
	const body = closing ? lines.slice(0, -1) : lines;
	// A sura opens with its name over the besmele — one short line the print sets apart.
	const heading = body.length > 1 && isBismillah(body[1]) ? body[0] : undefined;
	const paragraph = body.filter(line => line !== heading && !isBismillah(line));
	const bismillah = body.find(isBismillah);

	return (
		<>
			{heading ? (
				<Typography style={[styles.heading, arabic]} textAlign='center'>
					{heading.text}
				</Typography>
			) : null}
			{bismillah ? (
				<Typography color={theme.colors.danger} style={[styles.bismillah, arabic]} textAlign='center'>
					{bismillah.text}
				</Typography>
			) : null}
			{paragraph.length > 0 ? (
				<Typography style={[styles.arabic, arabic]} textAlign='center'>
					{setArabic(
						paragraph.map(line => line.text).join(' '),
						faces,
						theme.colors.danger,
						theme.colors.accent,
						numerals
					)}
				</Typography>
			) : null}
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
export const HizbBody = memo((props: HizbBodyProps) => {
	const delail = splitDelailRepetition(props.block);
	if (delail) {
		return (
			<>
				<DelailReading progress={props.delailProgress}>
					<HizbBodyContent {...props} block={delail.passage} />
				</DelailReading>
				<HizbBodyContent {...props} block={delail.after} />
			</>
		);
	}
	const parts = splitIstighfar(props.block);
	if (!parts) {
		return <HizbBodyContent {...props} />;
	}
	return (
		<>
			<HizbBodyContent {...props} block={parts.introduction} />
			<IstighfarReading progress={props.istighfarProgress}>
				<HizbBodyContent {...props} block={{ lines: [parts.sentence] }} />
			</IstighfarReading>
		</>
	);
});
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
	},
	heading: {
		marginBottom: 8
	}
});
