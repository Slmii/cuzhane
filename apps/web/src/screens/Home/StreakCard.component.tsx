import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { weekStrip, type WeekDay } from '@/lib/utils/weekStrip';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StreakCardProps } from './StreakCard.types';

/** The design's 27pt circle, and the tick that fits inside one. */
const DAY_SIZE = 27;
const TICK_SIZE = 12;

/**
 * H1's first card: how many days in a row, what the best run was, and the week as seven
 * squares — a tick for a day read, a filled square for today, the rest of the week faint
 * ahead of it. `weekStrip` decides which is which; this only colours them.
 *
 * The strip is **this calendar week**, not the last seven days, so the week visibly fills up.
 * Day letters come from `Intl` in the interface language rather than a table of twenty-one
 * strings — the same thing the reset countdown does with times.
 */
export const StreakCard = ({ last30Days, longestStreakDays, streakDays }: StreakCardProps) => {
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();

	/*
	 * **Today is the payload's last day, not the device clock.** `last30Days` ends on today as
	 * the server bucketed it, in the zone the client asked for — reading the clock here instead
	 * lets the two disagree whenever they resolve a different day (no zone reported, a zone
	 * changed mid-session, or the app left open across midnight with the old payload), which
	 * showed a tick on a square the strip called future. Falling back to the clock only when
	 * there is no payload at all, where nothing can disagree.
	 */
	const today = useMemo(() => {
		const last = last30Days[last30Days.length - 1];

		if (last === undefined) {
			return new Date();
		}

		const [year, month, day] = last.date.split('-').map(Number);

		// Local midnight of that day: `new Date('YYYY-MM-DD')` would parse as UTC and slide.
		return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
	}, [last30Days]);
	const week = useMemo(() => weekStrip(last30Days, today), [last30Days, today]);
	const dayLabel = useMemo(() => new Intl.DateTimeFormat(language, { weekday: 'short' }), [language]);

	const toneFor = (day: WeekDay) => {
		if (day.isToday) {
			// Filled only once something has been read today. Solid from midnight would say the
			// day was done before it was begun — and the streak line beside it would disagree.
			return day.hasRead
				? { background: theme.colors.accent, border: theme.colors.accent, foreground: theme.colors.onAccent }
				: {
						background: theme.colors.transparent,
						border: theme.colors.accent,
						foreground: theme.colors.accent
				  };
		}

		if (day.hasRead) {
			return {
				background: theme.colors.accentSoft,
				border: theme.colors.accentSoft,
				foreground: theme.colors.accent
			};
		}

		// A day gone by with nothing read and a day still to come are drawn the same: the
		// square is simply empty. Nothing here needs to reproach anybody.
		return {
			background: theme.colors.transparent,
			border: theme.colors.border,
			foreground: theme.colors.faintText
		};
	};

	return (
		<CardSurface style={styles.card}>
			<View style={styles.head}>
				<View>
					<EyebrowText color={theme.colors.accent}>{t('streakCurrent')}</EyebrowText>
					<Typography style={styles.value} variant='header1' weight='regular'>
						{/* Its own line for one, so English reads "1 day" — the same pair the round's countdown uses. */}
						{streakDays === 0
							? t('streakNone')
							: streakDays === 1
							? t('dayCountOne')
							: t('dayCount', { count: streakDays })}
					</Typography>
				</View>
				{/* Only once there is a record to hold on to. */}
				{longestStreakDays > 0 ? (
					<CaptionText color={theme.colors.faintText} style={styles.best}>
						{t('streakBest', { count: longestStreakDays })}
					</CaptionText>
				) : null}
			</View>
			<View style={[styles.week, { borderTopColor: theme.colors.border }]}>
				{week.map(day => {
					const tone = toneFor(day);

					return (
						<View key={day.key} style={styles.day}>
							<Typography color={theme.colors.faintText} style={styles.dayLabel} weight='medium'>
								{dayLabel.format(day.date)}
							</Typography>
							<View
								style={[
									styles.mark,
									{ backgroundColor: tone.background, borderColor: tone.border },
									// Today's square is solid, so its number needs no dimming; a
									// day still to come is the faint end of the same scale.
									day.isFuture ? { opacity: 0.55 } : null
								]}
							>
								{day.hasRead ? (
									<Icon color={tone.foreground} name='check' size={TICK_SIZE} strokeWidth={2.4} />
								) : (
									<Typography color={tone.foreground} style={styles.dayNumber} weight='semibold'>
										{String(day.date.getDate())}
									</Typography>
								)}
							</View>
						</View>
					);
				})}
			</View>
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	best: {
		paddingTop: 5
	},
	card: {
		paddingBottom: 4,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	day: {
		alignItems: 'center',
		flex: 1,
		gap: 7
	},
	dayLabel: {
		fontSize: 10,
		lineHeight: 13
	},
	dayNumber: {
		fontSize: 11,
		lineHeight: 14
	},
	head: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	},
	mark: {
		alignItems: 'center',
		borderRadius: DAY_SIZE / 2,
		borderWidth: StyleSheet.hairlineWidth,
		height: DAY_SIZE,
		justifyContent: 'center',
		width: DAY_SIZE
	},
	value: {
		fontSize: 27,
		lineHeight: 30,
		marginTop: 4
	},
	week: {
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 5,
		marginTop: 14,
		paddingVertical: 12
	}
});
