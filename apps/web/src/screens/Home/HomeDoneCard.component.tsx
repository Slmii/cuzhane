import { ReadingTypeMark } from '@/components/ui/ReadingTypeMark/ReadingTypeMark.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { hizbPartsLabel } from '@/lib/utils/groups';
import { StyleSheet, View } from 'react-native';
import type { HomeDoneCardProps } from './HomeDoneCard.types';
import { HomeTopCard } from './HomeTopCard.component';
import { PortionBar } from './PortionBar.component';

const MARK_SIZE = 26;

/**
 * B8b — the day is done. "Bugünün payı" full, a segment a share, and what tomorrow opens with.
 * No "Serbest oku" button: the footer's two links already read without a share.
 */
export const HomeDoneCard = ({ count, tomorrow }: HomeDoneCardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<HomeTopCard>
			<View style={styles.topRow}>
				<Typography color={theme.colors.accent} style={styles.eyebrow} variant='eyebrow' weight='semibold'>
					{t('homeTodayShare')}
				</Typography>
				<View style={[styles.badge, { backgroundColor: theme.colors.accentSoft }]}>
					<Typography color={theme.colors.accent} style={styles.badgeLabel} weight='semibold'>
						{t('homeShareRead', { done: count, total: count })}
					</Typography>
				</View>
			</View>

			<PortionBar segments={{ filled: count, total: count }} />

			{tomorrow ? (
				<View style={styles.tomorrow}>
					<ReadingTypeMark
						backgroundColor={theme.colors.card}
						color={toAlphaColor(theme.colors.accent, 0.6)}
						kind={tomorrow.kind}
						size={MARK_SIZE}
					/>
					<View style={styles.tomorrowCopy}>
						<Typography
							color={toAlphaColor(theme.colors.text, 0.5)}
							style={styles.tomorrowLabel}
							weight='medium'
						>
							{t('homeTomorrowNext')}
						</Typography>
						<Typography numberOfLines={1} style={styles.tomorrowRange} variant='title' weight='regular'>
							{tomorrow.kind === 'HIZB'
								? hizbPartsLabel(tomorrow.range, t)
								: t(tomorrow.kind === 'HATIM' ? 'homeCuzRange' : 'homeBabRange', {
										range: tomorrow.range
								  })}
							{/* The group's name runs on in the body face, as one line with the place. */}
							<Typography
								color={toAlphaColor(theme.colors.text, 0.55)}
								style={styles.tomorrowGroup}
								weight='medium'
							>
								{` · ${tomorrow.groupName}`}
							</Typography>
						</Typography>
					</View>
				</View>
			) : null}
		</HomeTopCard>
	);
};

const styles = StyleSheet.create({
	badge: {
		borderRadius: 20,
		paddingHorizontal: 9,
		paddingVertical: 4
	},
	badgeLabel: {
		fontSize: 10.5,
		lineHeight: 13
	},
	eyebrow: {
		fontSize: 10,
		letterSpacing: 0.9
	},
	tomorrow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingTop: 2
	},
	tomorrowCopy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	// A nested span re-declares its line height, or it inherits nothing sensible from the serif.
	tomorrowGroup: {
		fontSize: 11.5,
		lineHeight: 19
	},
	tomorrowLabel: {
		fontSize: 10.5,
		lineHeight: 14
	},
	tomorrowRange: {
		fontSize: 17,
		lineHeight: 19
	},
	topRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	}
});
