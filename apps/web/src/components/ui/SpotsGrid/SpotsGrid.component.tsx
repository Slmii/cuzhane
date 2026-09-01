import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useMemo, useState } from 'react';
import type { SpotsGridProps } from './SpotsGrid.types';

/**
 * `spot-stepper.html`'s `STAGGER` — "ms between neighbouring cells", and the same number
 * `spots-grid.html` passes as its `stagger` option.
 *
 * **Not `FILL_STEP_MS`.** It was tied to the üstlen sweep's rate on the grounds that both are
 * cascades, and at 18ms ten seats came and went inside 162ms — fast enough that the stagger
 * stopped reading as one, which is half of why the minus looked like a cut.
 */
const CASCADE_STEP_MS = 26;
/** `CellGrid`'s `shrink` keyframe — `om-shrink .3s`. Kept in step by hand: it is the ghost's
 *  whole lifetime, and a ghost unmounted early is a seat that blinks out. */
const SHRINK_DURATION_MS = 300;

/**
 * How long the ghosts stay mounted: the last one's stagger plus its shrink, and a frame's
 * grace so the animation ends before the cell is dropped rather than under it.
 *
 * **The one number not taken from the prototype.** `spot-stepper.html` hard-codes
 * `GHOST_LIFE = 340`, and its own comment says that "must outlast om-shrink (300ms +
 * stagger)" — which at its own ±5 step it already doesn't: five ghosts need 4 × 26 + 300 =
 * 404ms, so the leftmost is cut at four fifths. The demo gets away with it because five cells
 * is the most it ever drops. Our picker steps 5 → 10 → 20, so going down drops ten at once and
 * wants 534ms; held to 340 the last six seats would blink out instead of collapsing, which is
 * the exact failure the ghosts exist to prevent. Deriving it is what makes the prototype's
 * behaviour survive a bigger step, so it is the literal transcription that would be wrong here.
 */
const ghostLifetimeMs = (ghostCount: number) => (ghostCount - 1) * CASCADE_STEP_MS + SHRINK_DURATION_MS + 32;

/**
 * The small seat lattice: filled cells are taken spots, empty cells are open.
 *
 * Design 05 animates both directions. Seats *added* pop in with a stagger. Seats *removed*
 * don't simply disappear — they stay on screen as "ghosts", in the colour they were already
 * wearing, and shrink away one after another; only then are they dropped. Deleting them
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
export const SpotsGrid = ({ columns = 10, filled, maxTotal, style, total }: SpotsGridProps) => {
	const { theme } = useThemeContext();
	const [shownCount, setShownCount] = useState(total);
	/**
	 * Seats that have just gone, still rendered so they can shrink away — held as the colour
	 * each of them was wearing, rather than as a count.
	 *
	 * **A ghost keeps the seat's own colour**, and this is the one place the two prototypes
	 * disagree — `spot-stepper.html` is the later of them and wins. `spots-grid.html` paints a
	 * leaving cell `--ghost: #ECEAE4` (our `babOpen`); `spot-stepper.html` drops that rule
	 * entirely and says so in a comment: "removed cells collapse — still accent-coloured —
	 * before they are unmounted".
	 *
	 * Repainting is what made the minus look broken however the timings were tuned. The shrink
	 * was running the whole time, staggered and to scale, but it was running on a near-white
	 * square against a near-white sheet, so there was nothing on screen to watch collapse — all
	 * anyone saw was a row of green blink out. Keeping the fill makes removal read as the
	 * reversal of the pop it undoes. The grey was meant to say "leaving"; it said "already gone".
	 */
	const [ghostColors, setGhostColors] = useState<string[]>([]);
	const [previous, setPrevious] = useState({ filled, total });

	/*
	 * **Derived during render, never from an effect** — and this is the difference between a
	 * shrink you watch and one that stutters.
	 *
	 * An effect runs *after* the commit, so dropping 20 → 10 committed one frame holding ten
	 * seats and no ghosts at all: the bottom row genuinely vanished, the effect then put ten
	 * ghosts back, and only the frame after that did they begin to shrink. On screen that is
	 * "the cells disappear, come back, and then the animation starts" — most visible on Android,
	 * where the extra commit is a preallocation and a mount rather than a reuse.
	 *
	 * The prototype has no such gap: `nudge()` assigns `ghosts` and calls `render()` in the same
	 * pass, so the doomed cells are on screen continuously from the tap. Adjusting state during
	 * render is React's equivalent — the extra pass happens before anything is committed, so
	 * there is never a painted frame between the seats leaving and the ghosts arriving.
	 *
	 * `previous` is state rather than a ref for the reason spelled out above about `shownCount`:
	 * a ref written during render is read back already-updated on StrictMode's second pass, and
	 * the ghosts would silently stop being created at all.
	 */
	if (previous.total !== total || previous.filled !== filled) {
		if (previous.total > total) {
			setGhostColors(
				Array.from({ length: previous.total - total }, (_, index) =>
					// The seat this ghost stands in for is the one that used to sit at `total + index`.
					total + index < previous.filled ? theme.colors.accent : theme.colors.track
				)
			);
		} else if (previous.total < total && ghostColors.length > 0) {
			// `spot-stepper.html`: "growing cancels ghosts". Tapping − then + inside the shrink
			// window otherwise leaves the old seats collapsing on the end of the row *after* the
			// new ones have popped in, so the grid plays both directions at once.
			setGhostColors([]);
		}

		setPrevious({ filled, total });
	}

	useEffect(() => {
		if (ghostColors.length === 0) {
			return undefined;
		}

		const timeout = setTimeout(() => setGhostColors([]), ghostLifetimeMs(ghostColors.length));

		return () => clearTimeout(timeout);
	}, [ghostColors]);

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
		 * The cascade runs *backwards* — `(ghosts - 1 - i) * STAGGER`, "rightmost leaves first" —
		 * so the last seat goes first and the wave retreats toward the ones you kept. The second
		 * place the two prototypes disagree, and again `spot-stepper.html` is the later:
		 * `spots-grid.html` delays by plain `i * stagger`, which sends removal the same way as
		 * the addition it undoes, so plus and minus play the same gesture and the minus reads as
		 * a second helping rather than as a reversal.
		 */
		const ghosts = ghostColors.map((backgroundColor, index) => ({
			backgroundColor,
			ghostDelay: (ghostColors.length - 1 - index) * CASCADE_STEP_MS,
			key: `ghost-${total + index}`
		}));

		return [...seats, ...ghosts];
	}, [filled, ghostColors, shownCount, theme, total]);

	return (
		<CellGrid
			columns={columns}
			gap={3}
			items={items}
			minRows={Math.ceil(Math.max(maxTotal ?? total, total) / columns)}
			radius={4}
			style={style}
		/>
	);
};
