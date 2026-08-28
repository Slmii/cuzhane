import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpotsGridProps } from './SpotsGrid.types';

const CASCADE_STEP_MS = 26;
/** Long enough for the last ghost's shrink to finish: 300ms plus a few steps of stagger. */
const GHOST_LIFETIME_MS = 340;

/**
 * The small seat lattice: filled cells are taken spots, empty cells are open.
 *
 * Design 05 animates both directions, and they are not mirror images. Seats *added* pop in
 * with a stagger. Seats *removed* don't simply disappear — they stay on screen as "ghosts",
 * greyed out, and shrink away one after another; only then are they dropped. Deleting them
 * outright is what made the minus button look broken: the count changed and a row of cells
 * blinked out of existence in a single frame with nothing to explain it.
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
	/** Seats that have just gone, still rendered so they can shrink away. */
	const [ghostCount, setGhostCount] = useState(0);
	const previousTotal = useRef(total);

	useEffect(() => {
		if (previousTotal.current > total) {
			setGhostCount(previousTotal.current - total);
		}

		previousTotal.current = total;
	}, [total]);

	useEffect(() => {
		if (ghostCount === 0) {
			return undefined;
		}

		const timeout = setTimeout(() => setGhostCount(0), GHOST_LIFETIME_MS);

		return () => clearTimeout(timeout);
	}, [ghostCount]);

	useEffect(() => {
		if (shownCount === total) {
			return undefined;
		}

		const frame = requestAnimationFrame(() => setShownCount(total));

		return () => cancelAnimationFrame(frame);
	}, [shownCount, total]);

	const items = useMemo<CellGridItem[]>(() => {
		const seats = Array.from({ length: total }, (_, index) => ({
			backgroundColor: index < filled ? theme.colors.accent : theme.colors.track,
			key: index,
			entryDelay: index >= shownCount ? (index - shownCount) * CASCADE_STEP_MS : undefined
		}));
		// Keyed past the live seats so a ghost is never confused with the seat that took its
		// place — reusing the index would have React treat the shrink as a colour change.
		const ghosts = Array.from({ length: ghostCount }, (_, index) => ({
			backgroundColor: theme.colors.babOpen,
			ghostDelay: index * CASCADE_STEP_MS,
			key: `ghost-${total + index}`
		}));

		return [...seats, ...ghosts];
	}, [filled, ghostCount, shownCount, theme, total]);

	return <CellGrid columns={columns} gap={3} items={items} radius={4} style={style} />;
};
