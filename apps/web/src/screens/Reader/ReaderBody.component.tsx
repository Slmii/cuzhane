import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { ayahMark, BISMILLAH, CEVSEN_AFTER_HUNDREDTH, clampReaderFontSize, getBab } from '@/lib/content/cevsen';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { arabicReaderFonts, arabicReaderFontScale } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReaderArabicFont } from '@/lib/types/domain';
import { BAB_COUNT } from '@/lib/utils/babs';
import { Fragment, type ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReaderBodyProps } from './ReaderBody.types';

/**
 * Faces whose `U+06DD` does not enclose the digits that follow it. Their marks are set in a
 * face that does, while the words stay in the face that was chosen.
 *
 * **Having the glyph is not the same as enclosing with it.** Enclosing is a shaping decision
 * the font makes across the mark *and* the digits, and the faces that decline it do so in
 * different ways: KFGQPC draws a wide standalone rosette that the number then sits beside, so
 * you get two marks; Hüsrev drew a hollow ring with the number stranded outside it. A face
 * missing the glyph altogether is worse again — iOS substitutes it from a system font, and
 * glyphs from two different fonts can never combine. Look at a real bab before adding a face.
 *
 * `uthman` is listed on the strength of its sibling rather than its own inspection: it carries
 * the mark at 0.708 × 0.855 em, the same standalone proportions the Madinah face had. Take it
 * out and look at a bab if that is worth checking — it is one word either way.
 */
const FACES_WITHOUT_ENCLOSING_MARK = new Set<ReaderArabicFont>(['uthman']);

const ornamentFaceFor = (font: ReaderArabicFont) =>
	FACES_WITHOUT_ENCLOSING_MARK.has(font) ? ('naskh' as const) : font;

/**
 * The divine name, set in the page's red the way the printed edition does.
 *
 * **The whole token must be the name.** Matching anything merely *containing* it is wrong
 * in both directions here: `اَللّٰهُمَّ` and `لِلّٰهِ` contain it but are other words, and the
 * refrain's `اِلٰهَ` — 106 of them, one per bab — is the same letters without the shadda, so
 * a loose test would paint "ilâh" red in every closing line. Anchoring the pattern and
 * letting marks fall where they like matches the three case forms the text actually sets
 * (`اللّٰهُ`, `اللّٰهِ`, `اَللّٰهُ`) and nothing else: 16 occurrences, counted across the data.
 *
 * The mark class is spelled out rather than `\p{M}`, which needs Unicode property escapes.
 */
const ARABIC_MARKS = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]';
const DIVINE_NAME = new RegExp(`^ا${ARABIC_MARKS}*ل${ARABIC_MARKS}*ل${ARABIC_MARKS}*ه${ARABIC_MARKS}*$`, 'u');

/**
 * Arabic split into runs so the divine name can carry its own colour.
 *
 * **Tokenised on whitespace and tested whole**, rather than matched inside the string. A
 * pattern hunting the name within the text finds it inside `اَللّٰهُمَّ`, whose first eight
 * characters *are* the name — so the word came out split down the middle with the front
 * half red. Only a token that is the name entirely counts.
 *
 * Neighbouring plain tokens are glued back into one run, so a paragraph costs a couple of
 * nodes rather than one per word: the du'a alone is some four hundred tokens and holds
 * fifteen names.
 *
 * The spans re-declare the face and size because a nested `Typography` otherwise applies
 * its own variant's `fontSize` and drops the Arabic back to body size — the same reason
 * the verse ornaments below set theirs explicitly.
 */
const withDivineName = (text: string, style: { color: string; fontFamily: string; fontSize: number }) => {
	const runs: ReactNode[] = [];
	let plain = '';

	text.split(/(\s+)/u).forEach((token, index) => {
		if (!DIVINE_NAME.test(token)) {
			plain += token;

			return;
		}

		if (plain) {
			runs.push(<Fragment key={`txt-${index}`}>{plain}</Fragment>);
			plain = '';
		}
		runs.push(
			<Typography
				color={style.color}
				key={`name-${index}`}
				style={{ fontFamily: style.fontFamily, fontSize: style.fontSize }}
			>
				{token}
			</Typography>
		);
	});
	if (plain) {
		runs.push(<Fragment key='txt-tail'>{plain}</Fragment>);
	}

	return runs;
};

/** The du'a's phrase separator, which needs the same treatment as the verse mark. */
const RUB_EL_HIZB = '۞';

const splitOnOrnament = (text: string) => text.split(new RegExp(`(${RUB_EL_HIZB})`, 'u')).filter(Boolean);

/**
 * The four numbers a page of Arabic needs: the face and size for the words, and the face and
 * size for the verse marks — which are not always the same face, see above.
 *
 * Exported because `MealSheet` sets the same invocation at the same size on another surface,
 * and both readers open it. Derived rather than stored: the reader's setting is one size in
 * points, and each face carries its own scale so that 24pt looks like 24pt in all of them.
 */
export const readerFaces = (font: ReaderArabicFont, chosenSize: number) => {
	const baseFontSize = clampReaderFontSize(chosenSize);
	const ornamentFace = ornamentFaceFor(font);

	return {
		arabicFont: arabicReaderFonts[font],
		arabicFontSize: Math.round(baseFontSize * arabicReaderFontScale[font]),
		baseFontSize,
		ornamentFont: arabicReaderFonts[ornamentFace],
		ornamentFontSize: Math.round(baseFontSize * arabicReaderFontScale[ornamentFace])
	};
};

/**
 * A bab as it is set on the page: the besmele where the edition puts it, the invocations
 * flowed as one paragraph, the refrain in red, and the du'a after the hundredth.
 *
 * **Shared by both readers, and it is the reason this is a component at all.** E2 reads a
 * group's share and B7 reads none, but the text is the same text — one file settles the
 * typography, the divine name's red, the verse marks and the four faces' quirks for both.
 * The differences between the two screens are all *around* this: the header, what may be
 * marked, and whether there is a footer to mark it with.
 *
 * Everything here is presentational. It knows the bab number, the face and the size, and
 * nothing about groups, rounds or ownership.
 */
export const ReaderBody = ({
	babNumber,
	font,
	fontSize: chosenSize,
	numerals,
	onLongPressInvocation
}: ReaderBodyProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const {
		arabicFont,
		arabicFontSize: fontSize,
		baseFontSize,
		ornamentFont,
		ornamentFontSize
	} = readerFaces(font, chosenSize);
	const cevsenBab = getBab(babNumber);

	/**
	 * Every invocation's Arabic, already split into coloured runs, keyed by invocation number.
	 *
	 * **Memoised because scrubbing re-renders the screen once per bab crossed**, and this body
	 * renders the *committed* bab, so its content is identical on every one of those renders.
	 * Without this, each of them re-tokenised all ten invocations on whitespace and rebuilt
	 * their runs, throwing the result away unchanged.
	 */
	const invocationRuns = useMemo(() => {
		const runs: Record<number, ReactNode> = {};

		// Re-derived in here rather than closed over: the faces come out of a call, and the
		// React Compiler will not preserve a manual memo whose deps it can't prove stable.
		const { arabicFont: face, arabicFontSize: size } = readerFaces(font, chosenSize);

		for (const invocation of cevsenBab?.invocations ?? []) {
			runs[invocation.n] = withDivineName(invocation.text, {
				color: theme.colors.danger,
				fontFamily: face,
				fontSize: size
			});
		}

		return runs;
	}, [cevsenBab, chosenSize, font, theme.colors.danger]);

	if (!cevsenBab || cevsenBab.invocations.length === 0) {
		return (
			<Typography color={theme.colors.faintText} style={styles.missing} textAlign='center'>
				{t('readerMissing')}
			</Typography>
		);
	}

	return (
		<>
			{/*
			 * The besmele opens the work, not each bab — the source sets it once, as bab 1's
			 * second line — so it appears on bab 1 and nowhere else. Set in the chosen face
			 * at the reading size, like the bab it heads.
			 *
			 * **Red in full**, like the refrain, rather than red only on the name inside it.
			 * The same reasoning applies to both: the line is a formula rather than one of
			 * the names, and colouring it whole is what sets it apart from the hundred. That
			 * also makes `withDivineName` redundant here — a red word inside a red line.
			 */}
			{babNumber === 1 && BISMILLAH ? (
				<Typography
					color={theme.colors.danger}
					style={[
						styles.bismillah,
						{
							fontFamily: arabicFont,
							fontSize,
							lineHeight: baseFontSize * 2,
							writingDirection: 'rtl'
						}
					]}
					textAlign='center'
				>
					{BISMILLAH}
				</Typography>
			) : null}
			{/*
			 * The whole bab as **one flowing paragraph**, the invocations run together
			 * and punctuated by their ornaments, wrapping to the column like prose.
			 *
			 * Not a line per invocation. Two earlier attempts tried to hold a fixed
			 * shape — the printed page's two-to-a-line, then one centred line each —
			 * and both fought the column: the page's type is narrower against its
			 * measure than ours, so its pairs overran, and centring left every line
			 * ragged at both ends with the ornaments scattered down the middle.
			 * Flowed, the text fills the measure at any of the three reading sizes and
			 * the ornaments fall wherever the words put them, which is what a printed
			 * Cevşen actually does.
			 *
			 * The words stay breakable. Bound with non-breaking spaces they couldn't
			 * wrap at all, so anything wider than the column fell back to character
			 * wrapping and split a word down the middle — the thing that binding
			 * existed to prevent. Ordinary spaces break between words only.
			 */}
			<Typography
				style={[
					styles.arabic,
					{
						fontFamily: arabicFont,
						fontSize,
						lineHeight: baseFontSize * 2,
						writingDirection: 'rtl'
					}
				]}
				textAlign='center'
			>
				{cevsenBab.invocations.map(invocation => (
					// A Fragment, not a nested Typography: that would apply its own
					// variant's `fontSize` and shrink the Arabic back to body size.
					<Fragment key={invocation.n}>
						{invocationRuns[invocation.n] ?? invocation.text}
						{/*
						 * Real spaces around the ornament, not just its margin — the
						 * invocations are concatenated with no separator of their own.
						 *
						 * The leading one is **non-breaking**, so the ornament can never
						 * wrap away from the invocation it closes and start the next
						 * line on its own. The trailing one is ordinary, which is where
						 * the line is meant to break.
						 */}{' '}
						{/*
						 * **The mark is what you long-press for the meaning**, not the words.
						 *
						 * The design asks for the ayah itself, and that cannot be done here: a
						 * nested `Typography` around a whole invocation stops the paragraph
						 * breaking inside it, so bab 9's long opening ran off both edges of the
						 * column and took two invocations off the screen with it. The mark
						 * survives the same nesting only because two characters never need to
						 * break. (A `Pressable` is out for the older reason — a view inside
						 * right-to-left text is painted where the line reserved nothing.)
						 *
						 * It reads well enough as its own idea: the mark *is* the ayah's
						 * number, so pressing ٤ to be told what the fourth one means needs no
						 * explaining beyond the hint under the text.
						 */}
						<Typography
							color={theme.colors.accent}
							onLongPress={() => onLongPressInvocation(invocation)}
							style={{ fontFamily: ornamentFont, fontSize: ornamentFontSize }}
							suppressHighlighting
						>
							{ayahMark(invocation.n, numerals)}
						</Typography>{' '}
					</Fragment>
				))}
			</Typography>
			{/*
			 * The refrain starts its own line and is set in the page's red. Run on from
			 * the last name it reads as one more of them, where it is actually the
			 * formula that ends every bab.
			 *
			 * **Its ornament is the only red one.** The verses' are the page's green,
			 * so the crimson marks the sübhâneke and nothing else — which is what
			 * separates the closing formula from the hundred names above it at a
			 * glance, without reading a word.
			 */}
			<Typography
				color={theme.colors.danger}
				style={[
					styles.arabic,
					styles.closing,
					{
						fontFamily: arabicFont,
						fontSize,
						lineHeight: baseFontSize * 2,
						writingDirection: 'rtl'
					}
				]}
				textAlign='center'
			>
				{cevsenBab.closing.text}
				{/*
				 * The colour has to be repeated here. A nested `Typography` applies
				 * its own default rather than inheriting the refrain's red, so
				 * without this the sübhâneke's own mark came out black against it.
				 */}
				<Typography
					color={theme.colors.danger}
					style={{ fontFamily: ornamentFont, fontSize: ornamentFontSize }}
				>
					{ayahMark(cevsenBab.closing.n, numerals)}
				</Typography>
			</Typography>

			{/*
			 * The supplication the edition prints after the hundredth bab. **Shown
			 * whenever bab 100 is open, to everyone**, with no ownership test.
			 *
			 * It was gated twice and wrong both times — first on `myBabNumbers`, then
			 * on `canMark` — and each gate hid it from someone sitting on the page it
			 * belongs to. The reader walks all hundred now, so whose *turn* bab 100
			 * is has nothing to do with whether the du'a printed after it should be
			 * legible: it is part of the text, like the refrain, not a reward for
			 * having marked something.
			 */}
			{babNumber === BAB_COUNT ? (
				<View style={styles.afterHundredth}>
					<EyebrowText color={theme.colors.faintText} textAlign='center'>
						{t('afterHundredth')}
					</EyebrowText>
					{/*
					 * One flowing paragraph, not a block per stored line. Those lines
					 * are where the *printed page* broke, at its width and its type
					 * size; reproducing them here stranded a short tail on a line of
					 * its own — `وَعَافِنَا` sitting alone under a full-width line —
					 * while the column still had room. The du'a is continuous prose,
					 * so let it wrap to this screen the way a bab's invocations do.
					 * The array keeps the print's own breaks, which is provenance
					 * worth keeping even though the reader doesn't lay them out.
					 */}
					<Typography
						style={[
							styles.arabic,
							styles.afterHundredthLine,
							{
								fontFamily: arabicFont,
								fontSize,
								lineHeight: baseFontSize * 2,
								writingDirection: 'rtl'
							}
						]}
						textAlign='center'
					>
						{splitOnOrnament(CEVSEN_AFTER_HUNDREDTH.join(' ')).map((part, index) =>
							part === RUB_EL_HIZB ? (
								<Typography
									key={`orn-${index}`}
									style={{ fontFamily: ornamentFont, fontSize: ornamentFontSize }}
								>
									{part}
								</Typography>
							) : (
								<Fragment key={`txt-${index}`}>
									{withDivineName(part, {
										color: theme.colors.danger,
										fontFamily: arabicFont,
										fontSize
									})}
								</Fragment>
							)
						)}
					</Typography>
				</View>
			) : null}
		</>
	);
};

const styles = StyleSheet.create({
	// Set apart from the refrain above it — this one really is a separate reading, so it gets
	// more air than the refrain does from the names.
	afterHundredth: {
		gap: 14,
		marginTop: 26
	},
	afterHundredthLine: {
		marginBottom: 0
	},
	arabic: {
		marginBottom: 22
	},
	bismillah: {
		marginBottom: 20
	},
	// Set apart from the names above it, without a rule: the refrain is part of the bab, not
	// a separate section.
	closing: {
		// Cancels the trailing margin inherited from `arabic`, which exists to separate the
		// names from this refrain and has nothing left to separate underneath it. Left in, it
		// stacked with the body's bottom padding for 42pt of air under the last line against
		// 26 above the first.
		marginBottom: 0,
		marginTop: 4
	},
	missing: {
		paddingVertical: 20
	}
});
