import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Cell } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { HIZB_WORKS } from '@/lib/content/hizbPortions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { HizbBoardProps } from './HizbBoard.types';
import { hizbCellItem } from './hizbCellPalette';
import { HizbLegend } from './HizbLegend.component';

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
					items.push(hizbCellItem(cell, theme, t));
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
				<HizbLegend />
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
	}
});

const styles = StyleSheet.create({
	indexLink: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 3
	}
});
