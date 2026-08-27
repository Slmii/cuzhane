import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { BrandMarkProps } from './BrandMark.types';

/** Five reading columns over a baseline — the app icon, drawn at any size. */
const COLUMN_HEIGHTS = [42, 58, 50, 66, 54] as const;
const COLUMN_WIDTH = 12;
const COLUMN_GAP = 17;
const COLUMN_ORIGIN_X = 10;
const BASELINE_Y = 82;
/** The last two columns are the "not yet read" half of the mark. */
const SOLID_COLUMN_COUNT = 3;

export const BrandMark = ({ color, fadedColor, size = 44, style }: BrandMarkProps) => {
	const { theme } = useThemeContext();
	const solid = color ?? theme.colors.accent;
	const faded = fadedColor ?? theme.colors.markFaded;

	return (
		<View style={style}>
			<Svg height={size} viewBox='0 0 100 100' width={size}>
				{COLUMN_HEIGHTS.map((height, index) => (
					<Rect
						fill={index < SOLID_COLUMN_COUNT ? solid : faded}
						height={height}
						key={height}
						rx={COLUMN_WIDTH / 2}
						width={COLUMN_WIDTH}
						x={COLUMN_ORIGIN_X + index * COLUMN_GAP}
						y={BASELINE_Y - height}
					/>
				))}
				<Rect fill={solid} height={8} rx={4} width={84} x={8} y={86} />
			</Svg>
		</View>
	);
};
