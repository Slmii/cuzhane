import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { MiniGrid } from '@/components/ui/MiniGrid/MiniGrid.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { CUZ_COUNT } from '@/lib/utils/units';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CellTone } from '@/lib/utils/cellTones';
import { heldTone, mineTone, readTone, unclaimedTone } from '@/lib/utils/cellTones';
import type { StringKey } from '@/lib/i18n/strings';
import type { AppTheme } from '@/lib/theme/tokens';
import type { CuzCellState, CuzMapLegendProps, CuzMapProps } from './CuzMap.types';

/**
 * One table, shared with the bab boards. `free` used to be drawn here with a pale grey
 * numeral on the tan, which `PoolGrid` had already found illegible and fixed on its own —
 * hence `cellTones`, so the next board cannot rediscover it a third time.
 */
const TONE_BY_STATE: Record<CuzCellState, (theme: AppTheme) => CellTone> = {
	free: unclaimedTone,
	mine: mineTone,
	read: readTone,
	// `heldTone`, not the boards' `takenTone`: on a cüz map held and read are the same green
	// at two depths — see the note on `heldTone`.
	taken: heldTone
};

/**
 * What the key calls each state. `mine` is the exception and takes its label from the call
 * site — the lobby reports what you *hold* ("senin") while the picker shows what you have
 * just *chosen* ("seçtin") — so it is the one entry with no word of its own here.
 */
const LEGEND_LABEL_KEY: Record<Exclude<CuzCellState, 'mine'>, StringKey> = {
	free: 'legendPool',
	read: 'legendDone',
	taken: 'legendOpen'
};

/** Read, held, free — the order the board fills in. */
const DEFAULT_LEGEND_STATES: CuzCellState[] = ['taken', 'free', 'mine'];

/** The frame's own grid for the thirty, in each of its two sizes — see `variant`. */
const GEOMETRY = {
	compact: { columns: 10, gap: 3, numberSize: 9, radius: 4 },
	picker: { columns: 6, gap: 5, numberSize: 12, radius: 9 }
} as const;

/** The picker's, for anything drawing a cell of its own beside one. */
export const CUZ_CELL_RADIUS = GEOMETRY.picker.radius;

/**
 * The thirty cüz as a map — the one drawing, used everywhere the thirty are shown at once.
 *
 * The lobby reports with it, QC4 and the join sheet pick with it, and they cannot disagree
 * about what a taken cüz looks like because there is one component and one palette. That
 * mattered more than it sounds: the picker was built first with **free and taken inverted**,
 * so hatching meant "somebody has this" there and "nobody has this" on every other board in
 * the app. The hatch is the pool's mark — `free` wears it.
 *
 * Read-only by default. Passing `onPress` is what makes it a picker, which keeps the lobby
 * from having to disable thirty cells one by one.
 */
export const CuzMap = ({ isPressable, labelOf, onPress, stateOf, style, variant = 'picker' }: CuzMapProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const geometry = GEOMETRY[variant];

	return (
		<MiniGrid columns={geometry.columns} gap={geometry.gap} style={style}>
			{size =>
				Array.from({ length: CUZ_COUNT }, (_, index) => {
					const number = index + 1;
					const state = stateOf(number);
					const canPress = onPress !== undefined && (isPressable?.(number) ?? true);
					const holderLabel = labelOf?.(number) ?? '';

					// The same three tones every numbered board in the app uses — see `cellTones`.
					const tone = TONE_BY_STATE[state](theme);

					return (
						<Pressable
							accessibilityLabel={t('cuzOrdinal', { n: number })}
							accessibilityRole={onPress ? 'checkbox' : 'text'}
							accessibilityState={{
								checked: state === 'mine',
								disabled: onPress !== undefined && !canPress
							}}
							disabled={!canPress}
							key={number}
							onPress={() => onPress?.(number)}
							style={({ pressed }) => [
								styles.cell,
								{
									backgroundColor: tone.backgroundColor,
									borderColor: tone.borderColor,
									borderRadius: geometry.radius,
									height: size,
									opacity: pressed ? 0.8 : 1,
									width: size
								}
							]}
						>
							{state === 'free' ? <Hatch radius={geometry.radius} /> : null}
							<Typography
								color={tone.labelColor}
								style={{ fontSize: geometry.numberSize }}
								variant='caption'
								weight={state === 'mine' ? 'semibold' : 'regular'}
							>
								{number}
							</Typography>
							{/* The holder's name under the number, ellipsised — thirty cells is
							    little room, and a name that wrapped would push the numeral off
							    centre on that one cell alone. */}
							{holderLabel ? (
								<Typography
									color={tone.labelColor}
									numberOfLines={1}
									style={styles.holder}
									variant='caption'
									weight='semibold'
								>
									{holderLabel}
								</Typography>
							) : null}
						</Pressable>
					);
				})
			}
		</MiniGrid>
	);
};

/**
 * The key under the map: **başkasında · havuz · (senin | seçtin)** by default.
 *
 * Those words come from the shared vocabulary every other board uses — they were "alındı"
 * and "boşta" here, which are the same two states the group board calls "başkasında" and
 * "havuz". Two labels differ by surface, and both legitimately: the lobby reports what you
 * *hold* ("senin") while the picker shows what you have just *chosen* ("seçtin"), and the
 * picker calls a hatched cell "boşta" rather than "havuz" — on a board you are choosing
 * from, that cell is a cüz going spare, not a pool being pointed at.
 *
 * `states` narrows it to what a given map actually draws — the join preview of a full
 * hatim has no free cells and no cells of yours, so listing either would be a key to
 * colours that are not on the board.
 */
export const CuzMapLegend = ({ freeLabel, mineLabel, states = DEFAULT_LEGEND_STATES }: CuzMapLegendProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	// The swatches are the cells' own tones, so a key cannot label a colour the board
	// stopped using — which is exactly how `BabLegend`'s pool swatch once drifted.
	const labelFor = (state: CuzCellState) => {
		if (state === 'mine') {
			return mineLabel ?? t('legendMine');
		}

		if (state === 'free') {
			return freeLabel ?? t(LEGEND_LABEL_KEY.free);
		}

		return t(LEGEND_LABEL_KEY[state]);
	};

	const entries = states.map(state => ({
		isHatched: state === 'free',
		label: labelFor(state),
		tone: TONE_BY_STATE[state](theme)
	}));

	return (
		<View style={styles.legend}>
			{entries.map(entry => (
				<View key={entry.label} style={styles.legendEntry}>
					<View style={[styles.swatch, { backgroundColor: entry.tone.backgroundColor }]}>
						{entry.isHatched ? <Hatch radius={4} /> : null}
					</View>
					<Typography color={theme.colors.subtext} variant='caption'>
						{entry.label}
					</Typography>
				</View>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	cell: {
		alignItems: 'center',
		// Every cell carries the same border width — an unringed one simply borrows its own
		// background — so no cell is a pixel smaller than its neighbours. The radius comes
		// from the variant, beside it in the style array.
		borderWidth: 1,
		justifyContent: 'center',
		overflow: 'hidden'
	},
	legend: {
		flexDirection: 'row',
		gap: 14,
		marginTop: 12
	},
	legendEntry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	// 7.5px in the frame, at 0.75 opacity; the same ratio to the numeral here.
	holder: {
		fontSize: 8,
		lineHeight: 10,
		maxWidth: '90%',
		opacity: 0.75
	},
	swatch: {
		borderRadius: 4,
		height: 11,
		overflow: 'hidden',
		width: 11
	}
});
