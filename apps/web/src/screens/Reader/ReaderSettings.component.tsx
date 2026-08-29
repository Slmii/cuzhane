import { Icon } from '@/components/ui/Icon/Icon.component';
import { Ornament } from '@/components/ui/Ornament/Ornament.component';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { READER_FONT_SIZES } from '@/lib/content/cevsen';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { arabicReaderFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReaderArabicFont, ReaderNumerals } from '@/lib/types/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReaderSettingsProps } from './ReaderSettings.types';

/**
 * The besmele, as a type specimen.
 *
 * Deliberately *not* `BISMILLAH` from `content/cevsen`, which is empty because the Cevşen
 * text was extracted from a printed edition that doesn't set it apart and the rule is that
 * nothing in the reader is approximated. This is a font sample in a settings sheet, not
 * scripture the app is presenting to be recited, and it is the one Arabic line every reader
 * knows by heart — which is exactly what makes it useful for judging a typeface.
 */
const PREVIEW_LINE = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

/** The rosette in the preview, and the numeral it shows. Both fixed — it is a sample. */
const PREVIEW_ORNAMENT_SIZE = 26;
const PREVIEW_ORNAMENT_NUMBER = 3;

/** "Aa" at each of the three settings, scaled down so all three fit one row of cards. */
const SIZE_SAMPLE_PX = [13, 16, 20];

const NUMERAL_OPTIONS: { glyph: string; key: ReaderNumerals }[] = [
	{ glyph: '١٢٣', key: 'arabic' },
	{ glyph: '123', key: 'latin' }
];

/**
 * Şehrizad leads because it is the default, and it is the default because it is the one that
 * reads closest to a printed Turkish Cevşen — it was matched against a page of one.
 */
const FONT_OPTIONS: ReaderArabicFont[] = ['scheherazade', 'naskh', 'amiri'];

/** The sample every typeface card sets, so the three are compared on the same word. */
const FONT_SAMPLE = 'بِسْمِ';

/**
 * The typeface's real family name, under its localised one and untranslated in either
 * language — these are proper nouns.
 *
 * Both are shown because neither alone is enough: "Şehrizad" doesn't tell you what you are
 * choosing, and "Scheherazade New" doesn't tell a Turkish reader it is the naskh they know.
 */
const FONT_FAMILY_NAMES: Record<ReaderArabicFont, string> = {
	amiri: 'Amiri Quran',
	naskh: 'Noto Naskh',
	scheherazade: 'Scheherazade New'
};

/**
 * E2a · Okuma ayarları — the reader's typography, opened from Aa.
 *
 * Three settings, all of them the person's rather than the group's: size, which digits the
 * verse ornaments carry, and which naskh the Cevşen is set in. Every one of them shows its
 * effect in the card above rather than describing it, because none of these choices can be
 * made from a label — "Amiri Quran" means nothing until you see the vocalisation it gives
 * you.
 *
 * It replaced a sheet that offered text size alone.
 */
export const ReaderSettings = ({ onChange, settings }: ReaderSettingsProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const fontLabels: Record<ReaderArabicFont, string> = {
		amiri: t('fontAmiri'),
		naskh: t('fontNaskh'),
		scheherazade: t('fontScheherazade')
	};

	// Selected reads as a filled, accented card; the rest as plain surfaces.
	const cardColors = (isSelected: boolean) => ({
		backgroundColor: isSelected ? theme.colors.accentSoft : theme.colors.surface,
		borderColor: isSelected ? theme.colors.accent : theme.colors.border
	});
	const cardText = (isSelected: boolean) => (isSelected ? theme.colors.text : theme.colors.subtext);

	const previewFont = arabicReaderFonts[settings.readerArabicFont];
	const previewSize = READER_FONT_SIZES[settings.readerFontScale] ?? READER_FONT_SIZES[0];

	return (
		<View style={styles.root}>
			{/*
			 * The preview is the point of the sheet, so it sits above the controls and shows
			 * all three settings at once — the line is in the chosen face at the chosen size,
			 * and the rosette beside it carries the chosen digits.
			 */}
			<View style={[styles.preview, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
				<EyebrowText color={theme.colors.faintText}>{t('previewLabel')}</EyebrowText>
				<View style={styles.previewRow}>
					{/*
					 * Green, and on the left. It stands for a verse ornament in the running
					 * text, and those are the page's green — the crimson is reserved for the
					 * sübhâneke alone. Left because that is where a rosette lands at the end of
					 * a right-to-left line.
					 */}
					<Ornament
						backgroundColor={theme.colors.surface}
						color={theme.colors.accent}
						n={PREVIEW_ORNAMENT_NUMBER}
						numerals={settings.readerNumerals}
						size={PREVIEW_ORNAMENT_SIZE}
					/>
					<Typography
						style={[
							styles.previewLine,
							{ fontFamily: previewFont, fontSize: previewSize, lineHeight: previewSize * 1.95 }
						]}
					>
						{PREVIEW_LINE}
					</Typography>
				</View>
			</View>

			<View style={styles.group}>
				<EyebrowText color={theme.colors.faintText}>{t('textSize')}</EyebrowText>
				<View style={styles.row}>
					{READER_FONT_SIZES.map((size, index) => {
						const isSelected = settings.readerFontScale === index;

						return (
							<Pressable
								accessibilityRole='button'
								accessibilityState={{ selected: isSelected }}
								key={size}
								onPress={() => onChange({ readerFontScale: index })}
								style={({ pressed }) => [
									styles.stackCard,
									cardColors(isSelected),
									{ opacity: pressed ? 0.9 : 1 }
								]}
							>
								<Typography
									color={cardText(isSelected)}
									style={{
										fontSize: SIZE_SAMPLE_PX[index],
										lineHeight: (SIZE_SAMPLE_PX[index] ?? 0) * 1.1
									}}
									variant='title'
								>
									Aa
								</Typography>
								<Typography color={cardText(isSelected)} variant='caption' weight='semibold'>
									{[t('fsSmall'), t('fsMed'), t('fsLarge')][index]}
								</Typography>
							</Pressable>
						);
					})}
				</View>
			</View>

			<View style={styles.group}>
				<EyebrowText color={theme.colors.faintText}>{t('numerals')}</EyebrowText>
				<View style={styles.row}>
					{NUMERAL_OPTIONS.map(option => {
						const isSelected = settings.readerNumerals === option.key;

						return (
							<Pressable
								accessibilityRole='button'
								accessibilityState={{ selected: isSelected }}
								key={option.key}
								onPress={() => onChange({ readerNumerals: option.key })}
								style={({ pressed }) => [
									styles.inlineCard,
									cardColors(isSelected),
									{ opacity: pressed ? 0.9 : 1 }
								]}
							>
								{/*
								 * A fixed-width column for the glyph, so ١٢٣ and 123 — which are
								 * nothing like the same width — still leave their labels on one
								 * vertical line.
								 */}
								<Typography
									color={cardText(isSelected)}
									style={[
										styles.numeralGlyph,
										option.key === 'latin'
											? null
											: [styles.numeralGlyphArabic, { fontFamily: arabicReaderFonts.naskh }]
									]}
								>
									{option.glyph}
								</Typography>
								<Typography color={cardText(isSelected)} variant='caption' weight='semibold'>
									{option.key === 'latin' ? t('numLatin') : t('numArabic')}
								</Typography>
								{/*
								 * Absolute, so the tick sits at the card's edge without joining the
								 * centred pair. In the flow it widened the selected card's contents
								 * and pushed its glyph and label off to one side, leaving the two
								 * cards visibly out of step with each other.
								 */}
								{isSelected ? (
									<Icon
										color={theme.colors.accent}
										name='check'
										size={14}
										style={styles.inlineMark}
									/>
								) : null}
							</Pressable>
						);
					})}
				</View>
			</View>

			<View style={styles.group}>
				<EyebrowText color={theme.colors.faintText}>{t('arabicFont')}</EyebrowText>
				<View style={styles.row}>
					{FONT_OPTIONS.map(font => {
						const isSelected = settings.readerArabicFont === font;

						return (
							<Pressable
								accessibilityRole='button'
								accessibilityState={{ selected: isSelected }}
								key={font}
								onPress={() => onChange({ readerArabicFont: font })}
								style={({ pressed }) => [
									styles.stackCard,
									cardColors(isSelected),
									{ opacity: pressed ? 0.9 : 1 }
								]}
							>
								{/* Each card sets its own face — that *is* the label. */}
								<Typography
									color={cardText(isSelected)}
									style={[styles.fontSample, { fontFamily: arabicReaderFonts[font] }]}
								>
									{FONT_SAMPLE}
								</Typography>
								<Typography
									color={cardText(isSelected)}
									textAlign='center'
									variant='caption'
									weight='semibold'
								>
									{fontLabels[font]}
								</Typography>
								<Typography
									color={theme.colors.faintText}
									style={styles.fontFamilyName}
									textAlign='center'
								>
									{FONT_FAMILY_NAMES[font]}
								</Typography>
							</Pressable>
						);
					})}
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	// Smaller than `caption`, because it is the footnote to the name above it and the cards
	// are only a third of the sheet wide.
	fontFamilyName: {
		fontSize: 9.5,
		lineHeight: 13
	},
	fontSample: {
		fontSize: 18,
		lineHeight: 27
	},
	group: {
		gap: 8
	},
	// Centred like the cards above it. The label used to be `flex: 1`, which shoved the tick
	// to the far edge and left the glyph and its label sitting off to one side.
	inlineCard: {
		alignItems: 'center',
		borderRadius: 14,
		borderWidth: 1.5,
		flex: 1,
		flexDirection: 'row',
		gap: 9,
		justifyContent: 'center',
		paddingHorizontal: 12,
		paddingVertical: 10
	},
	inlineMark: {
		position: 'absolute',
		right: 12
	},
	numeralGlyph: {
		flex: 0,
		fontSize: 15,
		lineHeight: 20,
		textAlign: 'center',
		width: 34
	},
	/**
	 * `alignItems: 'center'` centres the two *boxes*, and Arabic-Indic digits sit high in
	 * theirs — they carry the ascent of a script with marks above the line, so `١٢٣` floated
	 * while `Arapça` beside it sat on the baseline. The nudge lines the glyphs up instead of
	 * the boxes; `transform` because it must not disturb the 34pt column the labels align on.
	 *
	 * Arabic only. `123` is set in the app's own face and already sits where it should.
	 */
	numeralGlyphArabic: {
		transform: [{ translateY: 2.5 }]
	},
	preview: {
		borderRadius: 16,
		borderWidth: 1,
		gap: 9,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	// `flexShrink`, never `flex: 1`. Growing to fill the row pinned the line to one edge and
	// the rosette to the other, with the card's whole width between them; shrink-wrapping
	// keeps the rosette where it belongs, immediately after the words it closes.
	previewLine: {
		flexShrink: 1,
		textAlign: 'right',
		writingDirection: 'rtl'
	},
	// Pushed to the end, and `row` so the rosette lands to the *left* of the Arabic — where
	// a right-to-left line finishes.
	previewRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'flex-end'
	},
	root: {
		gap: 13
	},
	row: {
		flexDirection: 'row',
		gap: 8
	},
	// Centred on both axes. The row stretches all three cards to the tallest, and the "Aa"
	// samples are three different sizes — left to align at the top, a 13px Küçük sat high in
	// a card sized by 20px Büyük.
	stackCard: {
		alignItems: 'center',
		borderRadius: 14,
		borderWidth: 1.5,
		flex: 1,
		gap: 4,
		justifyContent: 'center',
		paddingHorizontal: 8,
		paddingVertical: 10
	}
});
