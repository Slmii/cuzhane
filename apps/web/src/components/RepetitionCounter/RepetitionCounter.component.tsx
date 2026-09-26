import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, NumericText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { RepetitionCounterProps } from './RepetitionCounter.types';

/** Five across, so nineteen and the zero come out as four full rows of thumb-sized cells. */
const PICKER_COLUMNS = 5;

/**
 * One light tap per recitation, so the count can be kept with the eyes on the page. Swallowed,
 * as the reader's own is: haptics are missing on web and off by a system setting elsewhere.
 */
const countTap = () => {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

/**
 * The count for a portion read more than once before it counts — Sekine, nineteen times from
 * its Besmele — as the bar above the reader's action row.
 *
 * **Three ways to move one number**: "+1" per recitation, which is the whole of it for someone
 * reading from the screen; the undo beside it for a tap too many; and the number itself, which
 * opens a lattice of every value to pick from — for repetitions already recited from the book,
 * which would otherwise mean tapping "+1" a dozen times to catch up.
 *
 * **A lattice, not a text field.** Picking is one tap and cannot be out of range, where typing
 * is a keyboard, two digits and a confirm, with a validation message for the values it has to
 * refuse. The cells up to the count are filled, so the sheet also reads as how far along it is.
 *
 * Presentational: the count arrives from the screen and every change goes straight back out.
 * The screen owns the write and whatever it is allowed to mark once the count is in.
 */
export const RepetitionCounter = ({ count, isDisabled = false, onChange, required, style }: RepetitionCounterProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const isKnown = count !== undefined && !isDisabled;
	const isComplete = count !== undefined && count >= required;

	const items = useMemo<CellGridItem[]>(
		() =>
			Array.from({ length: required + 1 }, (_, value) => {
				const isCurrent = value === count;
				const isCounted = count !== undefined && value > 0 && value < count;

				return {
					accessibilityLabel: t('hizbRepetitions', { count: value, required }),
					backgroundColor: isCurrent
						? theme.colors.accent
						: isCounted
						? theme.colors.accentSoft
						: theme.colors.track,
					key: value,
					label: value,
					labelColor: isCurrent
						? theme.colors.onAccent
						: isCounted
						? theme.colors.accent
						: theme.colors.subtext
				};
			}),
		[count, required, t, theme]
	);

	// Held steady for `CellGrid`, whose cells are memoised on it.
	const pick = useCallback(
		(key: string | number) => {
			setIsPickerOpen(false);

			if (key !== count) {
				onChange(Number(key));
			}
		},
		[count, onChange]
	);

	return (
		<>
			<View style={[styles.row, style]}>
				<Pressable
					accessibilityHint={t('enterCount')}
					accessibilityLabel={t('hizbRepetitions', { count: count ?? '—', required })}
					accessibilityRole='button'
					disabled={!isKnown}
					onPress={() => setIsPickerOpen(true)}
					style={({ pressed }) => [styles.count, { opacity: pressed ? 0.7 : 1 }]}
				>
					{/* Accent once it is enough, so the number itself says the button below has woken up. */}
					<NumericText color={isComplete ? theme.colors.accent : theme.colors.text}>
						{`${count ?? '—'} / ${required}`}
					</NumericText>
					<View style={[styles.enter, { opacity: isKnown ? 1 : 0.45 }]}>
						<Icon color={theme.colors.accent} name='edit' size={14} strokeWidth={1.8} />
						<CaptionText color={theme.colors.accent} weight='semibold'>
							{t('enterCount')}
						</CaptionText>
					</View>
				</Pressable>
				<AppButton
					accessibilityLabel={t('markUnread')}
					disabled={!isKnown || count === 0}
					fullWidth={false}
					icon='undo'
					onPress={() => count !== undefined && onChange(count - 1)}
					variant='surface'
				/>
				<AppButton
					disabled={!isKnown || isComplete}
					fullWidth={false}
					onPress={() => {
						if (count === undefined) {
							return;
						}

						countTap();
						onChange(count + 1);
					}}
					title={t('hizbRepetitionAdd')}
					variant='primary'
				/>
			</View>

			{/* Beside the row, not in it: the sheet's host is absolutely placed and no part of the row. */}
			<AppBottomSheet
				description={t('enterCountHint')}
				isVisible={isPickerOpen}
				onClose={() => setIsPickerOpen(false)}
				title={t('enterCount')}
			>
				<CellGrid columns={PICKER_COLUMNS} gap={8} items={items} onPressCell={pick} radius={12} />
			</AppBottomSheet>
		</>
	);
};

const styles = StyleSheet.create({
	count: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	enter: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 4
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	}
});
