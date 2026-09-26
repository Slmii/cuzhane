import { AppButton } from '@/components/ui/Button/Button.component';
import { ReadingTypeMark } from '@/components/ui/ReadingTypeMark/ReadingTypeMark.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupKind } from '@/lib/types/domain';
import { StyleSheet, View } from 'react-native';
import type { HomeFirstStepCardProps } from './HomeFirstStepCard.types';
import { HomeTopCard } from './HomeTopCard.component';

const TILE_SIZE = 30;
const MARK_SIZE = 22;
const KINDS: GroupKind[] = ['CEVSEN', 'HATIM'];

/**
 * B9 — belonging to no group yet, in B8's place: "İlk adım" where "Sıradaki" would be, with both
 * kinds' marks in the corner since either is a first step, and the two ways into a group side by
 * side.
 */
export const HomeFirstStepCard = ({ onCreate, onJoin }: HomeFirstStepCardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<HomeTopCard>
			<View style={styles.topRow}>
				<Typography color={theme.colors.accent} style={styles.eyebrow} variant='eyebrow' weight='semibold'>
					{t('homeFirstStep')}
				</Typography>
				<View style={styles.tiles}>
					{KINDS.map(kind => (
						<View key={kind} style={[styles.tile, { backgroundColor: theme.colors.accentSoft }]}>
							<ReadingTypeMark backgroundColor={theme.colors.accentSoft} kind={kind} size={MARK_SIZE} />
						</View>
					))}
				</View>
			</View>

			<View style={styles.copy}>
				<Typography style={styles.title} variant='title' weight='regular'>
					{t('homeEmptyTitle')}
				</Typography>
				<Typography color={toAlphaColor(theme.colors.text, 0.58)} style={styles.body}>
					{t('homeEmptyBody')}
				</Typography>
			</View>

			<View style={styles.actions}>
				<View style={styles.action}>
					<AppButton onPress={onJoin} size='md' title={t('homeEmptyJoin')} variant='primary' />
				</View>
				<View style={styles.action}>
					<AppButton onPress={onCreate} size='md' title={t('homeEmptyCreate')} variant='outline' />
				</View>
			</View>
		</HomeTopCard>
	);
};

const styles = StyleSheet.create({
	action: {
		flex: 1
	},
	actions: {
		flexDirection: 'row',
		gap: 8
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
	tile: {
		alignItems: 'center',
		borderRadius: 9,
		height: TILE_SIZE,
		justifyContent: 'center',
		width: TILE_SIZE
	},
	tiles: {
		flexDirection: 'row',
		gap: 6
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
