import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useMemo } from 'react';
import type { ActivityHeatmapProps } from './ActivityHeatmap.types';

/** Four-step intensity ramp — 0 reads, 1, 2, then 3+. */
const intensityForCount = (count: number) => {
	if (count <= 0) {
		return 0;
	}

	return Math.min(3, count);
};

export const ActivityHeatmap = ({ columns = 15, days, style }: ActivityHeatmapProps) => {
	const { theme } = useThemeContext();

	const items = useMemo<CellGridItem[]>(() => {
		const ramp = [theme.colors.heatEmpty, theme.colors.heatLow, theme.colors.heatMid, theme.colors.heatHigh];

		return days.map(day => ({
			accessibilityLabel: `${day.date}: ${day.count}`,
			backgroundColor: ramp[intensityForCount(day.count)] as string,
			key: day.date
		}));
	}, [days, theme]);

	return <CellGrid columns={columns} gap={4} items={items} radius={3} style={style} />;
};
