import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Cell } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, TitleText, Typography } from '@/components/ui/Typography/Typography.component';
import { HIZB_WORKS } from '@/lib/content/hizbPortions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { AppTheme } from '@/lib/theme/tokens';
import type { HizbBoardCell } from '@/lib/utils/groups';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { HizbBoardProps } from './HizbBoard.types';

/**
 * The cell the Cevşen's board comes out at on a phone, rather than HZ1's 24: the two boards are
 * the same lattice on the same screen, and a Hizb row never holds more than five, so the larger
 * cell still leaves the work's name its room.
 */
export const HIZB_CELL_SIZE = 28;
export const HIZB_CELL_GAP = 4;
export const HIZB_CELL_RADIUS = 6;
/** The ring on a portion of yours — the same 1.5 on every cell, so none changes size. */
const RING_WIDTH = 1.5;
const SWATCH_RADIUS = 3;

/**
 * At module scope, taking the theme, so the rows below can be memoised on `[cells, theme]`.
 *
 * The tokens are the pool board's: `poolFree` and the hatch for a portion nobody holds,
 * `poolTaken` for one somebody does, the accent for read. Yours is a `text` ring over whichever
 * of those it is — the design's outer shadow, drawn as the border because a cell clips.
 */
const paletteFor = ({ isMine, state }: Pick<HizbBoardCell, 'isMine' | 'state'>, theme: AppTheme) => {
	const fill =
		state === 'read'
			? { backgroundColor: theme.colors.accent, labelColor: theme.colors.onAccent }
			: state === 'pool'
			? { backgroundColor: theme.colors.poolFree, labelColor: theme.colors.sandText }
			: { backgroundColor: theme.colors.poolTaken, labelColor: theme.colors.poolTakenText };

	return { ...fill, borderColor: isMine ? theme.colors.text : fill.backgroundColor };
};

/**
 * A cell's state as a word, for its accessibility label — the legend's own, so a screen reader
 * hears the same key the sighted reader reads under the board.
 */
const STATE_LABEL_KEYS = {
	pool: 'hizbLegendPool',
	read: 'hizbLegendRead',
	taken: 'hizbLegendTaken'
} as const;

/** The legend's four keys, each drawn by the palette it explains. */
const LEGEND = [
	{ cell: { isMine: false, state: 'read' }, labelKey: 'hizbLegendRead' },
	{ cell: { isMine: false, state: 'taken' }, labelKey: 'hizbLegendTaken' },
	{ cell: { isMine: false, state: 'pool' }, labelKey: 'hizbLegendPool' },
	{ cell: { isMine: true, state: 'taken' }, labelKey: 'hizbLegendMine' }
] as const;

/**
 * "Grubun ilerlemesi" for a Hizb group (HZ1): a row per work, its portions at the right.
 *
 * Not a `CellGrid`. The Cevşen's hundred is a square lattice sized off the card's width; the
 * Hizb's thirty-three are ten short runs of one to five, each beside the name of the work it
 * belongs to, so every cell is the same fixed size and the rows are right-aligned. The cells
 * themselves are `CellGrid`'s own `Cell`, so the easing, the memo and the rule about mounting
 * the hatch are the ones the Cevşen board already keeps.
 *
 * The board is not tappable. Nothing in HZ1 opens from a cell — the whole card leads to the
 * index — and a Hizb portion is a place in the text rather than a square worth opening on its
 * own.
 */
const HizbBoardComponent = ({ cells, onPressIndex, style }: HizbBoardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	// Read once here and handed down, as `CellGrid` does, rather than asked by every cell.
	const isReducedMotion = useReducedMotion();

	const rows = useMemo(() => {
		const byNumber = new Map(cells.map(cell => [cell.number, cell]));

		return HIZB_WORKS.map(work => {
			const items: CellGridItem[] = [];

			for (let number = work.parts[0]; number <= work.parts[1]; number += 1) {
				const cell = byNumber.get(number);

				if (cell) {
					items.push({
						...paletteFor(cell, theme),
						// "Bölüm 4, Okundu" — and "Senin" after it for one of yours, which is what the
						// ring says to a reader who can see it.
						accessibilityLabel: [
							`${t('portion')} ${number}`,
							t(STATE_LABEL_KEYS[cell.state]),
							...(cell.isMine ? [t('hizbLegendMine')] : [])
						].join(', '),
						isHatched: cell.state === 'pool',
						key: number,
						label: number
					});
				}
			}

			return { items, key: work.key, title: t(work.titleKey) };
		});
	}, [cells, t, theme]);

	return (
		<CardSurface isFlush style={style}>
			<View style={[hizbBoardLayout.header, { borderBottomColor: theme.colors.divider }]}>
				<TitleText>{t('groupProgress')}</TitleText>
				{onPressIndex ? (
					<Pressable
						accessibilityRole='button'
						hitSlop={8}
						onPress={onPressIndex}
						style={({ pressed }) => [styles.indexLink, { opacity: pressed ? 0.6 : 1 }]}
					>
						<CaptionText color={theme.colors.accent}>{t('hizbIndexLink')}</CaptionText>
						<Icon color={theme.colors.accent} name='chevronRight' size={15} strokeWidth={1.8} />
					</Pressable>
				) : null}
			</View>
			<View style={hizbBoardLayout.body}>
				{rows.map(row => (
					<View key={row.key} style={hizbBoardLayout.row}>
						<CaptionText
							color={theme.colors.subtext}
							numberOfLines={1}
							style={hizbBoardLayout.rowTitle}
							weight='medium'
						>
							{row.title}
						</CaptionText>
						<View style={hizbBoardLayout.cells}>
							{row.items.map(item => (
								<Cell
									borderWidth={RING_WIDTH}
									isReducedMotion={isReducedMotion}
									item={item}
									key={item.key}
									radius={HIZB_CELL_RADIUS}
									size={HIZB_CELL_SIZE}
								/>
							))}
						</View>
					</View>
				))}
				<View style={hizbBoardLayout.legend}>
					{LEGEND.map(entry => {
						const palette = paletteFor(entry.cell, theme);

						return (
							<View key={entry.labelKey} style={hizbBoardLayout.legendEntry}>
								<View
									style={[
										styles.swatch,
										{ backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }
									]}
								>
									{/* The primitive the cells use, so the key can't drift from the thing it keys. */}
									{entry.cell.state === 'pool' ? <Hatch radius={SWATCH_RADIUS} /> : null}
								</View>
								<Typography color={theme.colors.subtext} style={styles.legendLabel} variant='caption'>
									{t(entry.labelKey)}
								</Typography>
							</View>
						);
					})}
				</View>
			</View>
		</CardSurface>
	);
};

/**
 * Memoised as a whole, as `CellGrid` is: the group screen re-renders on every read, sheet and
 * refetch, and with `cells` held steady there is nothing here that needs to run for it.
 */
export const HizbBoard = memo(HizbBoardComponent);

HizbBoard.displayName = 'HizbBoard';

/**
 * The board's frame, shared with `HizbBoardSkeleton` so the stand-in takes exactly the height
 * the board will and nothing below it moves when the board lands.
 */
export const hizbBoardLayout = StyleSheet.create({
	// The Cevşen board's heading row, so the two cards head alike.
	header: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 13,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	body: {
		paddingBottom: 14,
		paddingHorizontal: 16,
		paddingTop: 8
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingVertical: 3
	},
	// Takes what the cells leave, and truncates there rather than pushing them off the card.
	rowTitle: {
		flex: 1,
		minWidth: 0
	},
	cells: {
		flexDirection: 'row',
		gap: HIZB_CELL_GAP
	},
	legend: {
		columnGap: 13,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 10,
		rowGap: 6
	},
	legendEntry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6,
		// The caption's own line, so a row of bones is as tall as a row of labels.
		minHeight: 17
	}
});

const styles = StyleSheet.create({
	indexLink: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 3
	},
	legendLabel: {
		fontSize: 10.5
	},
	swatch: {
		borderRadius: SWATCH_RADIUS,
		borderWidth: RING_WIDTH,
		height: 11,
		overflow: 'hidden',
		width: 11
	}
});
