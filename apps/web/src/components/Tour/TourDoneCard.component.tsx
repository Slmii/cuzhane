import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { TourDoneMark } from './TourDoneMark.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';

type TourDoneCardProps = {
	onClose: () => void;
	onCreateGroup: () => void;
};

/**
 * O9 — the closing card.
 *
 * **One way onward and one way out.** The frame gives it two destinations, C2 (create a group)
 * and D4 (Keşfet), on the reasoning that the tour opens on an account belonging to no group and
 * the honest ending is a way into one. Creating one stayed; Keşfet became Kapat, because a tour
 * that ends by sending you somewhere else a second time offers no way to simply be finished —
 * and the reader has just been walked through fourteen stops. Keşfet is a tab, one tap away.
 */
export const TourDoneCard = ({ onClose, onCreateGroup }: TourDoneCardProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={[styles.card, { backgroundColor: theme.colors.sheet }]}>
			{/* A drawing being finished, not a checkbox being ticked — see `TourDoneMark`. */}
			<TourDoneMark />
			<Typography style={styles.title} variant='header2'>
				{t('tourDoneTitle')}
			</Typography>
			<Typography color={toAlphaColor(theme.colors.text, 0.55)} style={styles.sub} variant='caption'>
				{t('tourDoneSub')}
			</Typography>
			<View style={styles.actions}>
				<AppButton onPress={onCreateGroup} size='lg' title={t('tourGoCreate')} />
				<AppButton onPress={onClose} size='lg' title={t('tourClose')} variant='surface' />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	actions: {
		gap: 8
	},
	card: {
		borderRadius: 24,
		elevation: 16,
		paddingBottom: 20,
		paddingHorizontal: 22,
		paddingTop: 26,
		shadowOffset: { height: 24, width: 0 },
		shadowOpacity: 0.3,
		shadowRadius: 30
	},
	sub: {
		alignSelf: 'center',
		marginBottom: 20,
		marginTop: 9,
		maxWidth: 250,
		textAlign: 'center'
	},
	title: {
		textAlign: 'center'
	}
});
