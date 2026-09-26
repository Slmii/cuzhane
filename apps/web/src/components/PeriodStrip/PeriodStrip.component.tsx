import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { MyProgressPeriod } from '@/lib/types/domain';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PeriodStripProps } from './PeriodStrip.types';

/**
 * How many columns the strip always draws — seven for a DAILY group, eight for a WEEKLY one,
 * six for a MONTHLY one.
 *
 * **Fixed, even when the group is younger than the window.** The columns are sized by
 * dividing the row, so letting the count follow the data would draw a two-day-old group as
 * two enormous squares and then shrink them every morning for a week. Missing periods are
 * rendered as empty space, which is a different claim from a missed one — the group did not
 * exist yet, and the strip must not say it fell behind.
 */
const COLUMNS = { DAILY: 7, WEEKLY: 8, MONTHLY: 6 } as const;

/**
 * The four states of a cell, from the design's legend: everything read, some of it, none of
 * it, and the period still open.
 *
 * An open cell is outlined rather than filled whatever has been read in it — the same
 * decision Home's week strip makes about today, and for the same reason: a solid square
 * would call the period finished while there is still time left in it.
 */
const toneFor = (period: MyProgressPeriod, theme: ReturnType<typeof useThemeContext>['theme']) => {
	if (period.isOpen) {
		return {
			background: theme.colors.surface,
			border: theme.colors.accent,
			foreground: theme.colors.accent
		};
	}

	if (period.owedCount > 0 && period.readCount >= period.owedCount) {
		return { background: theme.colors.accent, border: theme.colors.accent, foreground: theme.colors.onAccent };
	}

	if (period.readCount === 0) {
		return { background: theme.colors.missed, border: theme.colors.missed, foreground: theme.colors.onAccent };
	}

	return { background: theme.colors.accentMid, border: theme.colors.accentMid, foreground: theme.colors.onAccent };
};

/**
 * The run of periods behind "Senin ilerlemen" — one cell per round, oldest on the left,
 * ending on the round still open.
 *
 * A cell is a *round*, so it means a day in a DAILY group and a week in a WEEKLY one. That
 * is why the labels differ: a daily round is named by its weekday, a weekly one by its
 * number, because "the week of the 4th" tells a reader nothing the round number doesn't.
 */
export const PeriodStrip = ({ cycle, periods, timezone }: PeriodStripProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();

	// Formatted in the *group's* zone: a round that opened at local midnight in Istanbul is
	// that day's round for everyone in the group, whatever zone they are reading from.
	const weekdayLabel = useMemo(
		() => new Intl.DateTimeFormat(language, { timeZone: timezone, weekday: 'short' }),
		[language, timezone]
	);

	const columns = COLUMNS[cycle];
	/*
	 * **The strip is the tail, not the whole record.** The payload carries every round this
	 * member has been in, because the banner's counts and the missed list are about all of
	 * them — the strip is the one place still asking a narrower question, and "Son 7 gün"
	 * above it is that question. Taken from the end, so it always finishes on the open round.
	 */
	const shown = periods.slice(-columns);
	// Right-aligned within the fixed column count, for a group younger than the window.
	const leading = Math.max(0, columns - shown.length);

	const labelFor = (period: MyProgressPeriod) => {
		if (cycle === 'WEEKLY') {
			return period.isOpen ? t('mpNow') : t('mpWeekLabel', { n: period.roundIndex + 1 });
		}

		return weekdayLabel.format(new Date(period.startedAt));
	};

	return (
		<View style={styles.row}>
			{Array.from({ length: leading }, (_, index) => (
				<View key={`blank-${index}`} style={styles.column} />
			))}
			{shown.map(period => {
				const tone = toneFor(period, theme);

				return (
					<View key={period.roundIndex} style={styles.column}>
						<View style={[styles.cell, { backgroundColor: tone.background, borderColor: tone.border }]}>
							<Typography color={tone.foreground} style={styles.cellLabel} weight='semibold'>
								{period.readCount}
							</Typography>
						</View>
						<Typography color={theme.colors.faintText} style={styles.periodLabel} variant='mono'>
							{labelFor(period)}
						</Typography>
					</View>
				);
			})}
		</View>
	);
};

const styles = StyleSheet.create({
	cell: {
		alignItems: 'center',
		aspectRatio: 1,
		borderRadius: 8,
		borderWidth: 1.5,
		justifyContent: 'center',
		width: '100%'
	},
	cellLabel: {
		fontSize: 11,
		lineHeight: 14
	},
	column: {
		alignItems: 'center',
		flex: 1,
		gap: 6
	},
	periodLabel: {
		fontSize: 9.5,
		lineHeight: 12
	},
	row: {
		flexDirection: 'row',
		gap: 5
	}
});
