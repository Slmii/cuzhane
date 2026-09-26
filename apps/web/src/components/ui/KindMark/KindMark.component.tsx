import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
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

const KindMarkComponent = ({ backgroundColor, kind, size = 48 }: KindMarkProps) => {
	const { theme } = useThemeContext();
	const color = theme.colors.accent;
	const cutOut = backgroundColor ?? theme.colors.background;

	return (
		<Svg height={size} viewBox={`0 0 ${GRID} ${GRID}`} width={size}>
			{kind === 'HIZB' ? (
				<>
					<Rect {...STAR_PLATE} fill={color} />
					<Rect {...STAR_PLATE} fill={color} transform='rotate(45 48 48)' />
					{/* The ring and the dot are the ground showing through, not a second colour. */}
					<Circle cx={48} cy={48} fill='none' r={12} stroke={cutOut} strokeWidth={4.5} />
					<Circle cx={48} cy={48} fill={cutOut} r={5} />
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
