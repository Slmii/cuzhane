import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { staggerWithinRuns, type PoolCellState } from '@/lib/utils/groups';
import { StyleSheet, View } from 'react-native';
import type { PoolGridProps } from './PoolGrid.types';

/** Matches the swatch below, so the hatch is clipped to the same rounding. */
const SWATCH_RADIUS = 3;
/** The design's ring on a bab you took — 1.5px, and the same width on every cell. */
const RING_WIDTH = 1.5;

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
export const PoolGrid = ({ cells, style }: PoolGridProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const paletteFor = (state: PoolCellState) => {
		switch (state) {
			case 'takenByMe':
				return {
					backgroundColor: theme.colors.accent,
					borderColor: theme.colors.text,
					labelColor: theme.colors.onAccent
				};
			case 'takenByOthers':
				return {
					backgroundColor: theme.colors.poolTaken,
					borderColor: theme.colors.poolTaken,
					labelColor: theme.colors.poolTakenText
				};
			default:
				return {
					backgroundColor: theme.colors.poolFree,
					borderColor: theme.colors.poolFree,
					labelColor: theme.colors.faintText
				};
		}
	};

	// Keyed on the slot where the caller knows it, otherwise on the state — a block is taken
	// whole, so a run of one state is the same boundary.
	const fillDelays = staggerWithinRuns(cells.map(cell => cell.slotIndex ?? cell.state));

	const legend = [
		{ isHatched: true, label: t('legendPool'), state: 'open' as const },
		{ isHatched: false, label: t('poolTakenOther'), state: 'takenByOthers' as const },
		{ isHatched: false, label: t('poolMine'), state: 'takenByMe' as const }
	];

	return (
		<View style={style}>
			{/*
			 * The üstlen sweep. Each cell's delay is its position inside its own slot, so
			 * taking a block repaints it left to right while everything else holds still —
			 * `pool-fill.html`'s `--i × --fill-step`.
			 */}
			<CellGrid
				borderWidth={RING_WIDTH}
				columns={10}
				gap={3}
				items={cells.map((cell, index) => ({
					...paletteFor(cell.state),
					fillDelay: fillDelays[index],
					isHatched: cell.state === 'open',
					key: cell.number,
					label: cell.number
				}))}
				radius={4}
			/>
			<View style={styles.legend}>
				{legend.map(entry => {
					const palette = paletteFor(entry.state);

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
