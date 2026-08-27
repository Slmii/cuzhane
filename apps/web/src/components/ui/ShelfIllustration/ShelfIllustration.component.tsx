import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ShelfIllustrationProps } from './ShelfIllustration.types';

/**
 * The brand mark drawn as an empty shelf: the reading columns become dashed outlines
 * over a solid baseline, so "no groups yet" reads as the same object as the logo.
 */
const VIEWBOX_WIDTH = 126;
const VIEWBOX_HEIGHT = 100;
const BAR_WIDTH = 14;
const BAR_RADIUS = 7;
const BAR_STROKE = 1.5;

/** `[x, y, height]` — x values keep each bar centred on the baseline below it. */
const BARS: [number, number, number][] = [
	[23, 30, 50],
	[45, 16, 64],
	[67, 38, 42],
	[89, 24, 56]
];

const BASELINE = { x: 10, y: 86, width: 106, height: 9, radius: 4.5 };
const LENS = { cx: 86, cy: 46, r: 21, stroke: 1.6 };
const LENS_HANDLE = 'M101 61l11 11';

export const ShelfIllustration = ({ hasMagnifier = false, style, width = 126 }: ShelfIllustrationProps) => {
	const { theme } = useThemeContext();

	// The magnifier draws attention, so the shelf behind it sits back a little further.
	const barColor = toAlphaColor(theme.colors.text, hasMagnifier ? 0.16 : 0.2);

	return (
		<View style={style}>
			<Svg
				fill='none'
				height={(width * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
				viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
				width={width}
			>
				{BARS.map(([x, y, height]) => (
					<Rect
						height={height}
						key={x}
						rx={BAR_RADIUS}
						stroke={barColor}
						strokeDasharray='5 6'
						strokeWidth={BAR_STROKE}
						width={BAR_WIDTH}
						x={x}
						y={y}
					/>
				))}
				<Rect
					fill={theme.colors.shelfBase}
					height={BASELINE.height}
					rx={BASELINE.radius}
					width={BASELINE.width}
					x={BASELINE.x}
					y={BASELINE.y}
				/>
				{hasMagnifier ? (
					<>
						<Circle
							cx={LENS.cx}
							cy={LENS.cy}
							fill={theme.colors.background}
							r={LENS.r}
							stroke={theme.colors.accent}
							strokeWidth={LENS.stroke}
						/>
						<Path
							d={LENS_HANDLE}
							stroke={theme.colors.accent}
							strokeLinecap='round'
							strokeWidth={LENS.stroke}
						/>
					</>
				) : null}
			</Svg>
		</View>
	);
};
