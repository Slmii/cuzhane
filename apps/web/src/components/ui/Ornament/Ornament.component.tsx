import { toOrnamentDigits } from '@/lib/content/cevsen';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { memo } from 'react';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import type { OrnamentProps } from './Ornament.types';

/**
 * The eight-lobed rosette that closes a verse, traced from the design system's Ornament Set
 * page. Two layers on a 26 grid:
 *
 * 1. **Petals** — eight r3 circles 5.4 out from the centre at 45° steps.
 * 2. **Centre** — an r6.3 disc filled with the page colour, which cuts the petals' inner
 *    halves away and leaves eight lobes rather than eight rings. This is why
 *    `backgroundColor` has to match whatever the ornament sits on.
 *
 * The spec has a third — an r4.5 dotted ring framing the numeral — which is **deliberately
 * dropped**. At reading size its dashes and the numeral's own strokes were the same weight,
 * so the two read as one texture instead of a number in a frame.
 *
 * The numeral is **SVG text on an explicit baseline**, which is the whole reason it sits
 * where it should. As a React Native `<Text>` overlaid on the drawing it came out riding
 * high in the rosette: RN centres a text's *line box*, and Noto Naskh's digits don't sit at
 * the centre of theirs. The design sets `y=16.3` against a centre of 13 for exactly this
 * reason, and `NUMERAL_BASELINE` is that offset expressed against the font size so it holds
 * at every digit count.
 */
const GRID = 26;
const CENTRE = GRID / 2;
const PETAL_RADIUS = 3;
const PETAL_ORBIT = 5.4;
const PETAL_COUNT = 8;

/** Petal centres, 45° apart. Computed rather than transcribed so the ring can't drift. */
const PETALS = Array.from({ length: PETAL_COUNT }, (_, index) => {
	const angle = (index / PETAL_COUNT) * 2 * Math.PI;

	return { cx: CENTRE + PETAL_ORBIT * Math.cos(angle), cy: CENTRE + PETAL_ORBIT * Math.sin(angle) };
});

/**
 * How much of the ornament the numeral takes, by digit count.
 *
 * The spec sets 14px, 11.5px and 9px against the 40px sample, so these are those three
 * divided by 40 — a rule rather than three magic numbers, which is what keeps the numeral
 * right at the 20 and 26 sizes too.
 */
const NUMERAL_SCALE = [0.35, 0.2875, 0.225] as const;

/**
 * How far below the centre the numeral's baseline sits, as a fraction of its font size.
 *
 * The design puts its 9.5px numeral's baseline at 16.3 on a grid centred at 13 — 3.3 down,
 * or 0.347 of the size, roughly half a cap height. Trimmed slightly from that: Noto Naskh's
 * Arabic-Indic digits carry more below the baseline than Latin ones do, so the geometric
 * half sat a touch low inside the ring.
 */
const NUMERAL_BASELINE = 0.29;

/**
 * `memo` because the reader draws eleven of these and the header above them re-renders on
 * every bab the rail's scrubber crosses. Each rosette is ten SVG nodes, so without this a
 * drag would reconcile a hundred-odd nodes per bab for a page that hasn't changed. All four
 * props are primitives, so the comparison is exact and free.
 */
const OrnamentComponent = ({ backgroundColor, color, n, numerals = 'arabic', size = GRID }: OrnamentProps) => {
	const { theme } = useThemeContext();
	const stroke = color ?? theme.colors.ornament;
	const fill = backgroundColor ?? theme.colors.background;
	const digits = n === undefined ? '' : toOrnamentDigits(n, numerals);
	const scale = NUMERAL_SCALE[Math.min(digits.length, NUMERAL_SCALE.length) - 1] ?? NUMERAL_SCALE[0];

	// In grid units, so the numeral scales with the drawing rather than with the screen.
	const numeralSize = GRID * scale;

	return (
		<Svg height={size} viewBox={`0 0 ${GRID} ${GRID}`} width={size}>
			<G fill='none' stroke={stroke} strokeWidth={0.9}>
				{PETALS.map(petal => (
					<Circle cx={petal.cx} cy={petal.cy} key={`${petal.cx}-${petal.cy}`} r={PETAL_RADIUS} />
				))}
			</G>
			<Circle cx={CENTRE} cy={CENTRE} fill={fill} r={6.3} stroke={stroke} strokeWidth={1.1} />
			{digits ? (
				<SvgText
					fill={stroke}
					// Latin digits set in the app's own face rather than in a naskh's Latin
					// fallback, which is a different design and looks like one.
					fontFamily={numerals === 'latin' ? appFonts.medium : appFonts.arabicNumeral}
					fontSize={numeralSize}
					textAnchor='middle'
					x={CENTRE}
					y={CENTRE + numeralSize * NUMERAL_BASELINE}
				>
					{digits}
				</SvgText>
			) : null}
		</Svg>
	);
};

export const Ornament = memo(OrnamentComponent);
