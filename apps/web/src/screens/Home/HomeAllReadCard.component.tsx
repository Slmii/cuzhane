import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { HomeAllReadCardProps } from './HomeAllReadCard.types';
import { HomeTopCard } from './HomeTopCard.component';

/**
 * B9b — in groups, and nothing is left to read: every share this round is finished, and none
 * of it today (that is B8b). A weekly share read on Monday, looked at on Wednesday. The count,
 * a line on what that means, and a new group as the way on — reading without a share is the
 * footer's two links, so the card does not repeat them.
 *
 * **It speaks of the reader's portions, not the groups' hatims.** The frame's "3 / 3 hatim
 * bitti" and "Tüm hatimler tamamlandı" claimed every group had finished, when only the reader's
 * own share had; and its "Yeni tur başlat" named something a group does by itself at its
 * boundary. The button opens "Yeni grup kur", so it says so.
 */
export const HomeAllReadCard = ({ count, onNewGroup }: HomeAllReadCardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<HomeTopCard>
			<View style={styles.topRow}>
				<Typography color={theme.colors.accent} style={styles.eyebrow} variant='eyebrow' weight='semibold'>
					{t('homeNoPending')}
				</Typography>
				<View style={[styles.badge, { backgroundColor: theme.colors.accentSoft }]}>
					<Typography color={theme.colors.accent} style={styles.badgeLabel} weight='semibold'>
						{t('homeSharesDone', { done: count, total: count })}
					</Typography>
				</View>
			</View>

			<View style={styles.copy}>
				<Typography style={styles.title} variant='title' weight='regular'>
					{t('homeAllDoneTitle')}
				</Typography>
				<Typography color={toAlphaColor(theme.colors.text, 0.58)} style={styles.body}>
					{t('homeAllDoneBody')}
				</Typography>
			</View>

			<AppButton onPress={onNewGroup} size='md' title={t('homeNewGroup')} variant='primary' />
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
	body: {
		fontSize: 12,
		lineHeight: 18.5
	},
	copy: {
		gap: 5
	},
	eyebrow: {
		fontSize: 10,
		letterSpacing: 0.9
	},
	title: {
		fontSize: 21,
		lineHeight: 25
	},
	topRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	}
});
