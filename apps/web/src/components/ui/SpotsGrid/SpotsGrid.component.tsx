import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpotsGridProps } from './SpotsGrid.types';

const CASCADE_STEP_MS = 18;
/** `CellGrid`'s `shrink` keyframe. Kept in step by hand — it is the ghost's whole lifetime. */
const SHRINK_DURATION_MS = 240;

/**
 * How long the ghosts stay mounted: the last one's stagger plus its shrink, and a frame's
 * grace so the animation ends before the cell is dropped rather than under it.
 *
 * Derived rather than fixed. A flat 340ms was enough back when the seat count moved one at
 * a time, but the picker now steps 5 → 10 → 20, so going down drops ten seats at once and
 * the tail of the cascade — 9 × 26ms of stagger before a 300ms shrink even starts — was
 * still mid-shrink when the timer unmounted it. The last few seats blinked out instead of
 * collapsing, which is the exact failure the ghosts exist to prevent.
 */
const ghostLifetimeMs = (ghostCount: number) => (ghostCount - 1) * CASCADE_STEP_MS + SHRINK_DURATION_MS + 32;

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

		const timeout = setTimeout(() => setGhostCount(0), ghostLifetimeMs(ghostCount));

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
		/*
		 * Keyed past the live seats so a ghost is never confused with the seat that took its
		 * place — reusing the index would have React treat the shrink as a colour change.
		 *
		 * The cascade runs *backwards*: the last seat goes first and the wave retreats toward
		 * the ones you kept. Delayed by index instead, removal travelled the same way as the
		 * addition it was undoing, so plus and minus played the same gesture and the minus
		 * read as a second helping rather than as a reversal.
		 */
		const ghosts = Array.from({ length: ghostCount }, (_, index) => ({
			backgroundColor: theme.colors.babOpen,
			ghostDelay: (ghostCount - 1 - index) * CASCADE_STEP_MS,
			key: `ghost-${total + index}`
		}));

		return [...seats, ...ghosts];
	}, [filled, ghostCount, shownCount, theme, total]);

	return <CellGrid columns={columns} gap={3} items={items} radius={4} style={style} />;
};
