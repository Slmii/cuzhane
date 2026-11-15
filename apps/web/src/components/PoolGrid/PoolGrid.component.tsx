import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { AppTheme } from '@/lib/theme/tokens';
import { mineTone, takenTone, unclaimedTone } from '@/lib/utils/cellTones';
import { FILL_STEP_MS, staggerWithinRuns, type PoolCellState } from '@/lib/utils/groups';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PoolGridProps } from './PoolGrid.types';

/** Matches the swatch below, so the hatch is clipped to the same rounding. */
const SWATCH_RADIUS = 3;
/** The design's ring on a bab you took — 1.5px, and the same width on every cell. */
const RING_WIDTH = 1.5;

/**
 * At module scope, taking the theme as an argument, so the cells below can be memoised on
 * `[cells, theme]` — a copy rebuilt per render would be a dependency that always changed,
 * and `CellGrid`'s cells are memoised on the identity of the items they are handed.
 */
const paletteFor = (state: PoolCellState, theme: AppTheme) => {
	switch (state) {
		case 'takenByMe':
			// Solid accent, **no ring**. It carried a `text`-coloured outline to separate it
			// from a read bab; with the block's own read state now shown by the two cases
			// below, the fill alone is unambiguous and the ring was only making your cells
			// louder than everyone's.
			return mineTone(theme);
		case 'takenByOthersRead':
			// The group board's "others read" tokens exactly — the same fact, so the same
			// colour. `poolTaken` happens to be this hex too, which is how claimed-but-unread
			// and read-by-someone came to look identical here.
			return {
				backgroundColor: theme.colors.babReadByOthers,
				borderColor: theme.colors.babReadByOthers,
				labelColor: theme.colors.babOthersText
			};
		case 'takenByOthers':
			// And the group board's "theirs, unread".
			return takenTone(theme);
		default:
			return unclaimedTone(theme);
	}
};

/**
 * The pool board (07a/07b/07c): every bab of every empty seat, numbered, in one of three
 * states — hatched for "still in the pool", a soft panel for "someone else took it", and
 * solid accent with a dark ring for "you took it".
 *
 * One component because the Havuz screen and the group screen's Havuz card show the same
 * board, and the group screen links straight to the Havuz screen. Written twice they would
 * drift, and two boards of the same babs disagreeing about who holds what is worse than
 * either being wrong on its own.
 *
 * The ring is a border rather than the design's outer `box-shadow`: `CellGrid` clips its
 * cells (`overflow: hidden`) so an outset shadow would never show, and giving *every* cell
 * the same border width — the unringed ones simply borrowing their own background colour —
 * keeps all the cells exactly the same size.
 */
export const PoolGrid = ({ cells, drainingSlotIndexes, style }: PoolGridProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const items = useMemo<CellGridItem[]>(() => {
		// Keyed on the slot where the caller knows it, otherwise on the state — a block is taken
		// whole, so a run of one state is the same boundary.
		const runKeys = cells.map(cell => cell.slotIndex ?? cell.state);
		const fillDelays = staggerWithinRuns(runKeys, FILL_STEP_MS, new Set(drainingSlotIndexes ?? []));

		return cells.map((cell, index) => ({
			...paletteFor(cell.state, theme),
			fillDelay: fillDelays[index] ?? 0,
			isHatched: cell.state === 'open',
			key: cell.number,
			label: cell.number
		}));
	}, [cells, drainingSlotIndexes, theme]);

	// Rebuilt only when the language changes. It was a fresh array on every render, which is
	// three times a second while a claim sweeps.
	const legend = useMemo(
		() => [
			// The shared vocabulary, not a set of its own — these are the same four states the
			// group board and the cüz maps draw, and the pool was naming them after the *act*
			// of claiming ("Sen üstlendin") rather than the state.
			{ isHatched: true, label: t('legendPool'), state: 'open' as const },
			{ isHatched: false, label: t('legendOpen'), state: 'takenByOthers' as const },
			{ isHatched: false, label: t('legendOthers'), state: 'takenByOthersRead' as const },
			{ isHatched: false, label: t('legendMine'), state: 'takenByMe' as const }
		],
		[t]
	);

	return (
		<View style={style}>
			{/*
			 * The üstlen sweep. Each cell's delay is its position inside its own slot, so
			 * taking a block repaints it left to right while everything else holds still —
			 * `pool-fill.html`'s `--i × --fill-step`.
			 */}
			<CellGrid borderWidth={RING_WIDTH} columns={10} gap={3} items={items} radius={4} />
			<View style={styles.legend}>
				{legend.map(entry => {
					const palette = paletteFor(entry.state, theme);

					return (
						<View key={entry.label} style={styles.entry}>
							<View
								style={[
									styles.swatch,
									{
										backgroundColor: palette.backgroundColor,
										borderColor: palette.borderColor
									}
								]}
							>
								{/* The same primitive the cells use, so a swatch can't drift from
								    the thing it is explaining. */}
								{entry.isHatched ? <Hatch radius={SWATCH_RADIUS} /> : null}
							</View>
							<Typography color={theme.colors.subtext} style={styles.label} variant='caption'>
								{entry.label}
							</Typography>
						</View>
					);
				})}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	entry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	label: {
		fontSize: 10.5
	},
	legend: {
		columnGap: 13,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 11,
		rowGap: 6
	},
	swatch: {
		borderRadius: SWATCH_RADIUS,
		borderWidth: RING_WIDTH,
		height: 11,
		overflow: 'hidden',
		width: 11
	}
});
