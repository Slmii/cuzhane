import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { suraInfo } from '@/lib/content/sura';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { arabicReaderFonts, arabicReaderFontScale } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReaderTextFont } from '@/lib/types/domain';
import { Fragment, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type SuraHeaderProps = {
	sura: number;
	/** The face chosen in Aa — the name is set in it, as the page below is. */
	font: ReaderTextFont;
	/**
	 * The sura's name in the interface language — "İsrâ", "Al-Isra" — in the caption under the
	 * cartouche, for a reader who does not read the Arabic, and what VoiceOver reads for it.
	 */
	name: string;
};

/*
 * **The mushaf's word, not the interface's**, so it is Arabic in every language and lives here
 * rather than in the strings table — as `LANGUAGE_NATIVE_NAMES` does for the same reason.
 */
const SURA_WORD = 'سورة';

/**
 * The name, in the face chosen in Aa at a fixed optical size: 24 before each face's measured
 * scale, as the reader sizes its text — so every face lands at one visual size, and the heading
 * does not move when the reading size does. The design's Amiri Bold at 38 was tried first and
 * was too large for a phone.
 */
const NAME_BASE_SIZE = 24;
/**
 * The design's cartouche height (92) at 70%, on request — it took too much of the page. The
 * flourishes and the gilt rule keep their own weights; only the panel shrinks.
 */
const CARTOUCHE_HEIGHT = 64;
/**
 * **The cartouche is as wide as the name**, plus this much each side to clear its pointed ends
 * and the gilt rule inside them — the flourishes take whatever the row has left, as they do in
 * the design at full width. It was a fixed 210 at first, which left short names adrift in it.
 */
const CARTOUCHE_END_PADDING = 34;
/** Never narrower than this, or a short name ("سورة ق") squashes the points into a diamond. */
const CARTOUCHE_MIN_WIDTH = CARTOUCHE_HEIGHT * 2;

/*
 * The cartouche, as the Icon Set draws it: a panel pointed at both ends, and a gilt rule inset
 * inside it. One viewBox stretched to the box (`preserveAspectRatio='none'`) with strokes that
 * do not stretch with it, so the points keep their line weight at any width.
 */
const CARTOUCHE_OUTER = 'M40 4H300C312 4 318 20 336 48C318 76 312 92 300 92H40C28 92 22 76 4 48C22 20 28 4 40 4Z';
const CARTOUCHE_INNER = 'M44 10H296C306 10 311 24 326 48C311 72 306 86 296 86H44C34 86 29 72 14 48C29 24 34 10 44 10Z';
/** The eight-pointed star at each flourish's outer end. */
const STAR = 'M0-10L2.9-7 7.1-7.1 7-2.9 10 0 7 2.9 7.1 7.1 2.9 7 0 10-2.9 7-7.1 7.1-7 2.9-10 0-7-2.9-7.1-7.1-2.9-7Z';

/**
 * A sura's heading — the Icon Set's "Sure başlığı", line for line: a pointed cartouche holding
 * "سورة …", flanked by a flourish on each side (a gilt star, a double sage rule, a gilt
 * diamond), and under it the sura's number, its name, where it was revealed and how long it is
 * ("17 · İsrâ · Mekkî · 111 âyet").
 *
 * **The typeset reader's only.** The Hüsrev pages print their own headings, as images.
 */
export const SuraHeader = ({ font, name, sura }: SuraHeaderProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	/*
	 * **The frame is drawn at the cartouche's measured width, never at `'100%'`.** The panel
	 * sizes to the name, and an `Svg` given percentages did not follow it: measured on the
	 * simulator, a 184pt cartouche held a frame about 112pt wide, the name running out of it.
	 * Numbers from `onLayout` are what the box actually is.
	 */
	const [cartoucheWidth, setCartoucheWidth] = useState(0);
	const handleCartoucheLayout = (event: LayoutChangeEvent) => setCartoucheWidth(event.nativeEvent.layout.width);
	const info = suraInfo(sura);

	if (!info) {
		return null;
	}

	const { accent, gilt, suraCartouche, text } = theme.colors;
	const nameSize = Math.round(NAME_BASE_SIZE * arabicReaderFontScale[font]);

	// Mirrored on the right: the star always at the outer end, the diamond against the cartouche.
	const renderFlourish = (isEnd: boolean) => (
		<View style={[styles.flourish, isEnd ? styles.flourishEnd : null]}>
			<Svg height={9} viewBox='-10 -10 20 20' width={9}>
				<Path d={STAR} fill={gilt} />
			</Svg>
			<View style={styles.rules}>
				<View style={[styles.rule, { backgroundColor: accent }]} />
				<View style={[styles.rule, styles.ruleFaint, { backgroundColor: accent }]} />
			</View>
			<View style={[styles.diamond, { borderColor: gilt }]} />
		</View>
	);

	const facts = [
		info.revelationPlace === 'makkah' ? t('qSuraMeccan') : t('qSuraMedinan'),
		t('qSuraVerses', { n: info.versesCount })
	];

	return (
		<View accessibilityLabel={name} accessibilityRole='header' accessible style={styles.root}>
			<View style={styles.band}>
				{renderFlourish(false)}
				<View onLayout={handleCartoucheLayout} style={styles.cartouche}>
					{cartoucheWidth > 0 ? (
						<Svg
							height={CARTOUCHE_HEIGHT}
							preserveAspectRatio='none'
							style={styles.frame}
							viewBox='0 0 340 96'
							width={cartoucheWidth}
						>
							<Path
								d={CARTOUCHE_OUTER}
								fill={suraCartouche}
								stroke={accent}
								strokeWidth={1.4}
								vectorEffect='non-scaling-stroke'
							/>
							<Path
								d={CARTOUCHE_INNER}
								fill='none'
								stroke={gilt}
								strokeWidth={0.9}
								vectorEffect='non-scaling-stroke'
							/>
						</Svg>
					) : null}
					<Typography
						color={text}
						numberOfLines={1}
						style={{
							fontFamily: arabicReaderFonts[font],
							fontSize: nameSize,
							// Room for the marks above and below the letters; a line as tight as the size
							// clips harakah in React Native.
							lineHeight: Math.round(nameSize * 1.5),
							writingDirection: 'rtl'
						}}
					>
						{`${SURA_WORD} ${info.nameArabic}`}
					</Typography>
				</View>
				{renderFlourish(true)}
			</View>

			<View style={styles.caption}>
				<EyebrowText color={accent} style={styles.captionText} weight='semibold'>
					{String(info.number)}
				</EyebrowText>
				<EyebrowText color={text} style={[styles.captionText, styles.captionFaint]} weight='medium'>
					{name}
				</EyebrowText>
				{facts.map(fact => (
					<Fragment key={fact}>
						<View style={[styles.dot, { backgroundColor: gilt }]} />
						<EyebrowText color={text} style={[styles.captionText, styles.captionFaint]} weight='medium'>
							{fact}
						</EyebrowText>
					</Fragment>
				))}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	band: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		maxWidth: 640,
		width: '100%'
	},
	caption: {
		alignItems: 'center',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
		justifyContent: 'center'
	},
	// The design's caption is the text colour at 55% — not `subtext`, which is a shade darker.
	captionFaint: {
		opacity: 0.55
	},
	// The design's 0.14em on an 11px eyebrow, wider than the variant's own tracking.
	captionText: {
		letterSpacing: 1.54
	},
	// Never shrinks: allowed to, it gave way to the flourishes below its own text's width and the
	// name spilled out of the panel. The flourishes are what give, down to their `minWidth`.
	cartouche: {
		alignItems: 'center',
		flexGrow: 0,
		flexShrink: 0,
		height: CARTOUCHE_HEIGHT,
		justifyContent: 'center',
		minWidth: CARTOUCHE_MIN_WIDTH,
		paddingHorizontal: CARTOUCHE_END_PADDING
	},
	diamond: {
		borderWidth: 1,
		height: 7,
		transform: [{ rotate: '45deg' }],
		width: 7
	},
	dot: {
		borderRadius: 1.5,
		height: 3,
		width: 3
	},
	frame: {
		left: 0,
		position: 'absolute',
		top: 0
	},
	flourish: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 6,
		minWidth: 24
	},
	flourishEnd: {
		flexDirection: 'row-reverse'
	},
	root: {
		alignItems: 'center',
		gap: 12
	},
	rule: {
		height: 1
	},
	ruleFaint: {
		opacity: 0.45
	},
	rules: {
		flex: 1,
		gap: 3
	}
});
