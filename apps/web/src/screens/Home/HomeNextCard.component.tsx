import { SliceChip } from '@/components/SliceChip/SliceChip.component';
import { TourTarget } from '@/components/Tour/TourTarget.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { ReadingTypeMark } from '@/components/ui/ReadingTypeMark/ReadingTypeMark.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { HomeNextCardProps } from './HomeNextCard.types';
import { HomeTopCard } from './HomeTopCard.component';
import { PortionBar } from './PortionBar.component';

const MARK_SIZE = 30;

/**
 * B8's "Sıradaki" — the one share to read now: the soonest deadline among what is still owed.
 * How long it has left, where it is, how far along, and one button that starts it or picks it
 * up where it was left (B8c's "Bab 22’den devam").
 *
 * The first-use tour's second and third stops are this card and its button: the tour's "your
 * groups" and "pick up where you left off" are now this one share.
 */
export const HomeNextCard = ({
	actionLabel,
	caption,
	deadline,
	fraction,
	heading,
	isDueToday,
	kind,
	moreCount,
	onPress,
	segments
}: HomeNextCardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<TourTarget id='groups'>
			<HomeTopCard onPress={onPress}>
				<View style={styles.topRow}>
					<Typography color={theme.colors.accent} style={styles.eyebrow} variant='eyebrow' weight='semibold'>
						{t('homeNextUp')}
					</Typography>
					{deadline ? (
						// Red on the day it is due — the one deadline that asks for today — warm otherwise.
						<View
							style={[
								styles.badge,
								{ backgroundColor: isDueToday ? theme.colors.missedSurface : theme.colors.deadline }
							]}
						>
							<Typography
								color={isDueToday ? theme.colors.missed : theme.colors.deadlineText}
								style={styles.badgeLabel}
								weight='semibold'
							>
								{deadline}
							</Typography>
						</View>
					) : null}
				</View>

				<View style={styles.subject}>
					<ReadingTypeMark backgroundColor={theme.colors.card} kind={kind} size={MARK_SIZE} />
					<View style={styles.subjectCopy}>
						<View style={styles.headingRow}>
							<Typography style={styles.heading} variant='title' weight='regular'>
								{heading}
							</Typography>
							{/* A share held in pieces names the stretch being read and counts the rest. */}
							<SliceChip count={moreCount} isCompact tone='soft' />
						</View>
						<Typography
							color={toAlphaColor(theme.colors.text, 0.58)}
							numberOfLines={1}
							style={styles.caption}
							weight='medium'
						>
							{caption}
						</Typography>
					</View>
				</View>

				<PortionBar {...(segments ? { segments } : { fraction: fraction ?? 0 })} />

				<TourTarget id='read'>
					<AppButton onPress={onPress} size='md' title={actionLabel} variant='primary' />
				</TourTarget>
			</HomeTopCard>
		</TourTarget>
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
	caption: {
		fontSize: 11.5,
		lineHeight: 15
	},
	eyebrow: {
		fontSize: 10,
		letterSpacing: 0.9
	},
	heading: {
		fontSize: 24,
		lineHeight: 26
	},
	headingRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	subject: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	subjectCopy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	topRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	}
});
