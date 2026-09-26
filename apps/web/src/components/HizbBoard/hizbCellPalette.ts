import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import type { StringKey } from '@/lib/i18n/strings';
import type { AppTheme } from '@/lib/theme/tokens';
import type { HizbBoardCell, HizbBoardCellState } from '@/lib/utils/groups';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

/**
 * **What a Hizb portion looks like, decided once** — the board on the group screen (HZ1), the
 * Havuz lattice (HZ3) and the Fihrist's number tiles (HZ2) all draw a portion from this, so the
 * three cannot come to disagree about what "read" or "yours" is painted in.
 *
 * The tokens are the pool board's: `poolFree` and the hatch for a portion nobody holds,
 * `poolTaken` for one somebody does, the accent for read. Yours is a `text` ring over whichever
 * of those it is — the design's outer shadow, drawn as the border because a cell clips.
 *
 * At module scope, taking the theme, so callers can memoise on `[cells, theme]`.
 */
export const hizbCellPalette = ({ isMine, state }: Pick<HizbBoardCell, 'isMine' | 'state'>, theme: AppTheme) => {
	const fill =
		state === 'read'
			? { backgroundColor: theme.colors.accent, labelColor: theme.colors.onAccent }
			: state === 'pool'
			? { backgroundColor: theme.colors.poolFree, labelColor: theme.colors.sandText }
			: { backgroundColor: theme.colors.poolTaken, labelColor: theme.colors.poolTakenText };

	return { ...fill, borderColor: isMine ? theme.colors.text : fill.backgroundColor };
};

/**
 * A cell's state as a word — the legend's own, so a screen reader hears the same key the sighted
 * reader reads under the board, and the Fihrist's rows say "Okundu" in the legend's words.
 */
export const HIZB_STATE_LABEL_KEYS: Record<HizbBoardCellState, StringKey> = {
	pool: 'hizbLegendPool',
	read: 'hizbLegendRead',
	taken: 'hizbLegendTaken'
};

/** The legend's four keys, each drawn by the palette it explains. */
export const HIZB_LEGEND = [
	{ cell: { isMine: false, state: 'read' }, labelKey: 'hizbLegendRead' },
	{ cell: { isMine: false, state: 'taken' }, labelKey: 'hizbLegendTaken' },
	{ cell: { isMine: false, state: 'pool' }, labelKey: 'hizbLegendPool' },
	{ cell: { isMine: true, state: 'taken' }, labelKey: 'hizbLegendMine' }
] as const;

/**
 * One portion as a `CellGrid` cell. "Bölüm 4, Okundu" — and "Senin" after it for one of yours,
 * which is what the ring says to a reader who can see it.
 */
export const hizbCellItem = (cell: HizbBoardCell, theme: AppTheme, t: Translate): CellGridItem => ({
	...hizbCellPalette(cell, theme),
	accessibilityLabel: [
		`${t('portion')} ${cell.number}`,
		t(HIZB_STATE_LABEL_KEYS[cell.state]),
		...(cell.isMine ? [t('hizbLegendMine')] : [])
	].join(', '),
	isHatched: cell.state === 'pool',
	key: cell.number,
	label: cell.number
});
