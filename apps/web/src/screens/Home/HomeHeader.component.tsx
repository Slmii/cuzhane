import { TourTarget } from '@/components/Tour/TourTarget.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HomeHeaderProps } from './HomeHeader.types';

/**
 * The room the navigator's account item takes at the row's right, beyond the header's own 22.
 * Not the frame's 36pt avatar: on iOS 26 the item is a 44pt target in the bar's glass capsule —
 * about 56 wide, 16 in from the edge — so it covers 72pt of the row, and the frame's 10 of air
 * goes after that (16 + 56 + 10 − 22). The item floats over this layer; the header keeps clear.
 */
export const HOME_HEADER_AVATAR_ROOM = 60;

/**
 * B8's coloured band: the greeting over the day's state in the heading face, and — beside the
 * account — the streak, compact: the count over the week as seven small pills, filled for each
 * day something was read. It was a card of its own on the sheet; the day's tasks took that
 * place, and the streak became the header's.
 */
export const HomeHeader = ({ greeting, streak, title }: HomeHeaderProps) => {
	const { theme } = useThemeContext();
	const insets = useSafeAreaInsets();
	const { language, t } = useTranslation();
	const onHeader = theme.colors.onHeaderSurface;
	const streakLabel = streak
		? t(pluralKey(language, streak.days, 'countDaysOne', 'countDaysOther'), { count: streak.days })
		: '';

	return (
		<View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
			<View style={styles.greeting}>
				<Typography color={toAlphaColor(onHeader, 0.6)} style={styles.greetingLabel} weight='medium'>
					{greeting}
				</Typography>
				{/* No line at all rather than a wrong one — a failed first load has no day to describe. */}
				{title ? (
					<Typography color={onHeader} style={styles.title} variant='header2' weight='regular'>
						{title}
					</Typography>
				) : null}
			</View>

			{streak ? (
				<TourTarget id='streak'>
					<View
						// Said as a streak — the pills beside the count are only a picture of it.
						accessibilityLabel={t('homeStreakLabel', { days: streakLabel })}
						accessible
						style={styles.streak}
					>
						<Typography color={onHeader} style={styles.streakValue} weight='semibold'>
							{streakLabel}
						</Typography>
						<View style={styles.week}>
							{streak.week.map(day => (
								<View
									key={day.key}
									style={[
										styles.pill,
										{
											backgroundColor: day.hasRead ? onHeader : theme.colors.transparent,
											borderColor: toAlphaColor(onHeader, 0.35)
										}
									]}
								/>
							))}
						</View>
					</View>
				</TourTarget>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	greeting: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	greetingLabel: {
		fontSize: 12,
		lineHeight: 15
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingBottom: 14,
		paddingLeft: 22,
		paddingRight: 22 + HOME_HEADER_AVATAR_ROOM
	},
	pill: {
		borderRadius: 3,
		borderWidth: 1,
		height: 14,
		width: 6
	},
	streak: {
		alignItems: 'flex-end',
		gap: 5
	},
	streakValue: {
		fontSize: 10.5,
		lineHeight: 13
	},
	title: {
		fontSize: 23,
		lineHeight: 25
	},
	week: {
		flexDirection: 'row',
		gap: 3
	}
});
