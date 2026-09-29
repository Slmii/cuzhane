import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { memo } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import type { KindMarkProps } from './KindMark.types';

/**
 * The two books' marks, from the design's kind cards (HC1) — filled emblems like `BrandMark`,
 * not line glyphs from the icon set, so they are drawn here rather than in `Icon`. Both sit on
 * the design's 96 grid and take the accent.
 *
 * **The tesbih's beads are computed, not dashed.** The design draws them as one r30 circle
 * stroked 7 wide with a `0.01 7.85` dash and round caps, which leaves a round dot every 7.85
 * along the arc — twenty-four of them, 15° apart from three o'clock, the seventh landing under
 * the tassel. That is the same drawing as twenty-four r3.5 discs, and the discs don't depend
 * on each platform's renderer agreeing about what a near-zero dash with a round cap looks like.
 * Computed rather than transcribed, as `Ornament`'s petals are, so the ring can't drift.
 */
const GRID = 96;
const BEAD_COUNT = 24;
const BEAD_ORBIT = 30;
const BEAD_RADIUS = 3.5;
const BEADS_CENTRE_X = 48;
const BEADS_CENTRE_Y = 42;

const BEADS = Array.from({ length: BEAD_COUNT }, (_, index) => {
	const angle = (index / BEAD_COUNT) * 2 * Math.PI;

	return { cx: BEADS_CENTRE_X + BEAD_ORBIT * Math.cos(angle), cy: BEADS_CENTRE_Y + BEAD_ORBIT * Math.sin(angle) };
});

/** Two 52-square plates, one turned 45°, make the Hizb's eight points. */
const STAR_PLATE = { height: 52, rx: 3, width: 52, x: 22, y: 22 } as const;

/** A full circle about the star's centre, as path data, so it can share one even-odd clip. */
const circleAt = (r: number) => `M${48 - r} 48a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/**
 * **The ring and the dot are holes, not paint.** The design draws them in "whatever colour sits
 * behind the mark", which they used to be told (`accentSoft` on a chosen card, the page
 * elsewhere) — and a group card is glass, where no one colour is behind it. So the star is
 * clipped instead: the whole box, then the ring's outer edge (r 14.25), its inner edge (r 9.75)
 * and the dot (r 5), filled even-odd, leaves the ring and the dot out of the star and lets the
 * ground show through wherever it is drawn.
 *
 * One fixed id for every instance. Native resolves it inside its own `Svg`; on the web a
 * duplicate resolves to the first in the document, which is the same shape on the same grid.
 */
const STAR_CUT_OUT = `M0 0H${GRID}V${GRID}H0Z${circleAt(14.25)}${circleAt(9.75)}${circleAt(5)}`;
const STAR_CLIP_ID = 'kindMarkStarCutOut';

const KindMarkComponent = ({ kind, size = 48 }: KindMarkProps) => {
	const { theme } = useThemeContext();
	const color = theme.colors.accent;

	return (
		<Svg height={size} viewBox={`0 0 ${GRID} ${GRID}`} width={size}>
			{kind === 'HIZB' ? (
				<>
					<Defs>
						<ClipPath id={STAR_CLIP_ID}>
							<Path clipRule='evenodd' d={STAR_CUT_OUT} />
						</ClipPath>
					</Defs>
					<G clipPath={`url(#${STAR_CLIP_ID})`}>
						<Rect {...STAR_PLATE} fill={color} />
						<Rect {...STAR_PLATE} fill={color} transform='rotate(45 48 48)' />
					</G>
				</>
			) : (
				<>
					{BEADS.map(bead => (
						<Circle cx={bead.cx} cy={bead.cy} fill={color} key={`${bead.cx}-${bead.cy}`} r={BEAD_RADIUS} />
					))}
					<Rect fill={color} height={10} rx={2.5} width={9} x={43.5} y={68} />
					<Path d='M48 78v6' fill='none' stroke={color} strokeLinecap='round' strokeWidth={3} />
					<Path
						d='M41 91c1.5-4.5 4-7 7-7s5.5 2.5 7 7'
						fill='none'
						stroke={color}
						strokeLinecap='round'
						strokeWidth={3}
					/>
				</>
			)}
		</Svg>
	);
};

/** `memo` for the same reason as `Ornament`: three primitive props, and later screens draw it in headers. */
export const KindMark = memo(KindMarkComponent);
