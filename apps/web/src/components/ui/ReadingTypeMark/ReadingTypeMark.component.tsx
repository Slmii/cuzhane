import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import type { ReadingTypeMarkProps } from './ReadingTypeMark.types';

/**
 * The two reading-type marks, from the design system's `Okuma Türü Simgeleri` page.
 *
 * **They say which kind a group is, and nothing else.** That is the page's first line —
 * "Grup türünü söyleyen iki sabit işaret; ilerleme taşımaz" — and it is a deliberate
 * reversal: an earlier revision drew progress into them, a tesbih of a hundred beads filling
 * as babs were read and an arc of thirty filling as cüz were. Every surface that shows a
 * mark already shows the progress beside it, in a bar or a board or a fraction, so the mark
 * was a second, coarser copy of a number stated better an inch away. A static mark also
 * reads at 24pt, which the filling one never did.
 *
 * Cevşen is a **tesbih**: twenty-four beads on a ring, the imame below it and a tassel.
 * Kur'an is an **open mushaf on a rahle**. Both are one colour — `currentColor` in the
 * export — on the same 96 grid.
 *
 * **The book's spine and page rules are knocked out, not drawn on.** They are painted in
 * whatever the mark is sitting on, so `backgroundColor` has to match the ground: the same
 * rule `ui/Ornament` records for the disc that cuts its petals into lobes.
 *
 * The three tiers are the export's own 96 / 48 / 24 drawings, not one drawing scaled. Detail
 * drops as it shrinks — the page rules go first, then the tassel's inner strokes, and the
 * 24 redraws the book larger within the box so it still reads.
 */
export const ReadingTypeMark = ({ backgroundColor, color, kind, size }: ReadingTypeMarkProps) => {
	const { theme } = useThemeContext();
	const ink = color ?? theme.colors.accent;
	const ground = backgroundColor ?? theme.colors.surface;

	return (
		<Svg fill='none' height={size} viewBox='0 0 96 96' width={size}>
			{kind === 'HATIM' ? renderMushaf(size, ink, ground) : renderTesbih(size, ink)}
		</Svg>
	);
};

/** Above this, the mark draws its full detail; below `SMALL_AT`, its most reduced. */
const MEDIUM_AT = 72;
const SMALL_AT = 36;

const tierFor = (size: number): 'full' | 'medium' | 'small' =>
	size >= MEDIUM_AT ? 'full' : size >= SMALL_AT ? 'medium' : 'small';

/**
 * A ring of beads, drawn as a **dashed circle with round caps** rather than twenty-four
 * placed circles: `0.01` of dash and a round cap is a dot, and the gap sets the spacing.
 * The circumference is 2π·30 ≈ 188.5, so a 7.85 gap gives exactly twenty-four.
 */
const renderTesbih = (size: number, ink: string) => {
	const tier = tierFor(size);

	if (tier === 'small') {
		return (
			<>
				<Circle
					cx={48}
					cy={40}
					r={30}
					stroke={ink}
					strokeDasharray={[0.01, 15.7]}
					strokeLinecap='round'
					strokeWidth={11}
				/>
				<Rect fill={ink} height={13} rx={4} width={14} x={41} y={68} />
				<Path d='M40 92c2-6 5-9 8-9s6 3 8 9' stroke={ink} strokeLinecap='round' strokeWidth={5} />
			</>
		);
	}

	if (tier === 'medium') {
		return (
			<>
				<Circle
					cx={48}
					cy={42}
					r={30}
					stroke={ink}
					strokeDasharray={[0.01, 11.78]}
					strokeLinecap='round'
					strokeWidth={8}
				/>
				<Rect fill={ink} height={11} rx={3} width={10} x={43} y={68} />
				<Path d='M48 79v6' stroke={ink} strokeLinecap='round' strokeWidth={4} />
				<Path d='M41 91c1.5-4.5 4-7 7-7s5.5 2.5 7 7' stroke={ink} strokeLinecap='round' strokeWidth={4} />
			</>
		);
	}

	return (
		<>
			<Circle
				cx={48}
				cy={42}
				r={30}
				stroke={ink}
				strokeDasharray={[0.01, 7.85]}
				strokeLinecap='round'
				strokeWidth={7}
			/>
			{/* The imame, its stem, and the tassel — two strokes so it falls rather than hangs. */}
			<Rect fill={ink} height={10} rx={2.5} width={9} x={43.5} y={68} />
			<Path d='M48 78v6' stroke={ink} strokeLinecap='round' strokeWidth={3} />
			<Path d='M41 91c1.5-4.5 4-7 7-7s5.5 2.5 7 7' stroke={ink} strokeLinecap='round' strokeWidth={3} />
			<Path
				d='M45.5 90.5c.6-3 1.5-5 2.5-6.5 1 1.5 1.9 3.5 2.5 6.5'
				stroke={ink}
				strokeLinecap='round'
				strokeWidth={3}
			/>
		</>
	);
};

/** The rahle's crossed legs under two filled pages, with the spine cut back out of them. */
const renderMushaf = (size: number, ink: string, ground: string) => {
	const tier = tierFor(size);

	if (tier === 'small') {
		return (
			<>
				<Path d='M20 90L56 54M76 90L40 54' stroke={ink} strokeLinecap='round' strokeWidth={8} />
				<Path d='M48 26C41 19 30 18 12 22v38c18-4 29-3 36 4.5z' fill={ink} />
				<Path d='M48 26C55 19 66 18 84 22v38c-18-4-29-3-36 4.5z' fill={ink} />
				<Path d='M48 28v34' stroke={ground} strokeLinecap='round' strokeWidth={4} />
			</>
		);
	}

	return (
		<>
			<Path
				d='M23 88L57 54M73 88L39 54'
				stroke={ink}
				strokeLinecap='round'
				strokeWidth={tier === 'full' ? 4.5 : 5.5}
			/>
			<Path d='M48 30C41 24 30 23.5 16 27v33c14-3.5 25-3 32 3.5z' fill={ink} />
			<Path d='M48 30C55 24 66 23.5 80 27v33c-14-3.5-25-3-32 3.5z' fill={ink} />
			<Path d='M48 32v29' stroke={ground} strokeLinecap='round' strokeWidth={tier === 'full' ? 2 : 2.6} />
			{/* Six rules standing for the text. Dropped below 72, where they close into a block. */}
			{tier === 'full' ? (
				<Path
					d='M22 35.5c6-1.6 12.5-1.6 18.5 .8M22 42c6-1.6 12.5-1.6 18.5 .8M22 48.5c6-1.6 12.5-1.6 18.5 .8M55.5 36.3c6-2.4 12.5-2.4 18.5-.8M55.5 42.8c6-2.4 12.5-2.4 18.5-.8M55.5 49.3c6-2.4 12.5-2.4 18.5-.8'
					stroke={ground}
					strokeLinecap='round'
					strokeWidth={1.8}
				/>
			) : null}
		</>
	);
};
