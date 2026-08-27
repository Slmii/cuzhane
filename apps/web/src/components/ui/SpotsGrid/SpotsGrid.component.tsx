import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useMemo, useState } from 'react';
import type { SpotsGridProps } from './SpotsGrid.types';

const CASCADE_STEP_MS = 26;

/**
 * The small seat lattice: filled cells are taken spots, empty cells are open.
 *
 * Only the cells that actually changed animate. `shownCount` lags `total` by one commit,
 * so the render that adds seats still sees the old count and can stagger just the new
 * cells; the ones already on screen keep `entryDelay` undefined and stay put.
 *
 * It has to be state rather than a ref: a ref mutated during render is read back
 * already-updated on StrictMode's second pass, which silently kills the cascade. The
 * catch-up is deferred a frame so the new cells mount — and capture their `entering` —
 * before `shownCount` moves.
 */
export const SpotsGrid = ({ columns = 10, filled, style, total }: SpotsGridProps) => {
	const { theme } = useThemeContext();
	const [shownCount, setShownCount] = useState(total);

	useEffect(() => {
		if (shownCount === total) {
			return undefined;
		}

		const frame = requestAnimationFrame(() => setShownCount(total));

		return () => cancelAnimationFrame(frame);
	}, [shownCount, total]);

	const items = useMemo<CellGridItem[]>(
		() =>
			Array.from({ length: total }, (_, index) => ({
				backgroundColor: index < filled ? theme.colors.accent : theme.colors.track,
				key: index,
				entryDelay: index >= shownCount ? (index - shownCount) * CASCADE_STEP_MS : undefined
			})),
		[filled, shownCount, theme, total]
	);

	return <CellGrid columns={columns} gap={3} items={items} radius={4} style={style} />;
};
