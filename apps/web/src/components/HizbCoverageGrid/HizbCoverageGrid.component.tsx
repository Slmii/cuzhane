import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { memo, useMemo } from 'react';
import type { HizbCoverageGridProps } from './HizbCoverageGrid.types';

/** Three rows of eleven: the 33 portions. */
const COLUMNS = 11;

/**
 * A Hizb plan group's day as the 33 portions (design "Hizb Kişisel Plan", W1–W4 and T4): read in
 * the accent, yours in the soft green with a ring, the rest quiet. On the "group done" band every
 * cell is read, so they turn white with the accent numeral.
 */
const HizbCoverageGridComponent = ({ cells, isOnBand = false }: HizbCoverageGridProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	// Held steady for `CellGrid`, whose cells are memoised on it.
	const items = useMemo<CellGridItem[]>(
		() =>
			cells.map(cell => {
				const isRead = cell.state === 'read';
				const backgroundColor = isOnBand
					? toAlphaColor(theme.colors.onAccent, 0.9)
					: isRead
					? theme.colors.accent
					: cell.isMine
					? theme.colors.accentMuted
					: theme.colors.segmentTrack;

				return {
					accessibilityLabel: `${t('portion')} ${cell.number}, ${t(isRead ? 'hizbLegendRead' : 'hpLegendLeft')}`,
					backgroundColor,
					// Yours is ringed; every other cell draws its border in its own fill, so none changes size.
					borderColor: cell.isMine ? theme.colors.text : backgroundColor,
					key: cell.number,
					label: cell.number,
					labelColor: isOnBand
						? theme.colors.accent
						: isRead
						? theme.colors.onAccent
						: cell.isMine
						? theme.colors.accent
						: theme.colors.faintText
				};
			}),
		[cells, isOnBand, t, theme]
	);

	return <CellGrid borderWidth={1.5} columns={COLUMNS} gap={4} items={items} radius={6} />;
};

export const HizbCoverageGrid = memo(HizbCoverageGridComponent);

HizbCoverageGrid.displayName = 'HizbCoverageGrid';
