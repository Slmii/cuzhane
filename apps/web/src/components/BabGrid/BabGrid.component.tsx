import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useMemo } from 'react';
import type { BabCellState, BabGridProps } from './BabGrid.types';

export const BabGrid = ({ cells, columns = 10, onPressBab, style }: BabGridProps) => {
	const { theme } = useThemeContext();

	const items = useMemo<CellGridItem[]>(() => {
		const toneFor = (state: BabCellState) => {
			switch (state) {
				case 'readByMe':
					return {
						backgroundColor: theme.colors.babReadByMe,
						borderColor: theme.colors.babReadByMe,
						labelColor: theme.colors.onAccent
					};
				case 'mineUnread':
					return {
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.accent,
						labelColor: theme.colors.accent
					};
				case 'readByOthers':
					return {
						backgroundColor: theme.colors.babReadByOthers,
						borderColor: theme.colors.babReadByOthers,
						labelColor: theme.colors.babOthersText
					};
				case 'takenByOthers':
					return {
						backgroundColor: theme.colors.surfaceMuted,
						borderColor: theme.colors.border,
						labelColor: theme.colors.faintText
					};
				case 'pool':
					// Same neutral fill as an untouched bab, plus the hatch — the pool isn't a
					// step on the progress scale, it's "this belongs to nobody".
					return {
						backgroundColor: theme.colors.babOpen,
						borderColor: theme.colors.babOpen,
						isHatched: true,
						labelColor: theme.colors.babOpenText
					};
				default:
					return {
						backgroundColor: theme.colors.babOpen,
						borderColor: theme.colors.babOpen,
						labelColor: theme.colors.babOpenText
					};
			}
		};

		return cells.map(cell => {
			const tone = toneFor(cell.state);

			return {
				accessibilityLabel: `Bab ${cell.number}`,
				backgroundColor: tone.backgroundColor,
				borderColor: tone.borderColor,
				isHatched: 'isHatched' in tone && tone.isHatched === true,
				key: cell.number,
				label: cell.number,
				labelColor: tone.labelColor
			};
		});
	}, [cells, theme]);

	return (
		<CellGrid
			borderWidth={1.5}
			columns={columns}
			gap={4}
			items={items}
			onPressCell={onPressBab ? key => onPressBab(Number(key)) : undefined}
			radius={6}
			style={style}
		/>
	);
};
