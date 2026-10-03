import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { Hint } from './hints';

type HintWelcomeCardProps = {
	hint: Hint;
	onPress: () => void;
};

/**
 * The welcome: the first card the app ever shows, centred over Ana sayfa, with one button. It
 * says hello and that short hints will follow on each screen.
 */
export const HintWelcomeCard = ({ hint, onPress }: HintWelcomeCardProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={[styles.card, { backgroundColor: theme.colors.card }]}>
			<View style={[styles.mark, { backgroundColor: theme.colors.accent, shadowColor: theme.colors.accent }]}>
				<BrandMark
					color={theme.colors.onHeaderSurface}
					fadedColor={toAlphaColor(theme.colors.onHeaderSurface, 0.55)}
					size={30}
				/>
			</View>
			<View>
				<Typography style={styles.title} variant='header2'>
					{t(hint.titleKey)}
				</Typography>
				<Typography color={toAlphaColor(theme.colors.text, 0.62)} style={styles.body} variant='caption'>
					{t(hint.bodyKey)}
				</Typography>
			</View>
			<AppButton
				onPress={onPress}
				size='lg'
				style={styles.action}
				title={t('hintWelcomeStart')}
				variant='primary'
			/>
		</View>
	);
};

/* The design's measures, one to one (section T, T1). */
const styles = StyleSheet.create({
	action: {
		marginTop: 4
	},
	body: {
		fontSize: 13,
		lineHeight: 20,
		marginTop: 7
	},
	card: {
		borderRadius: 22,
		elevation: 12,
		gap: 14,
		paddingBottom: 20,
		paddingHorizontal: 20,
		paddingTop: 22,
		shadowOffset: { height: 18, width: 0 },
		shadowOpacity: 0.28,
		shadowRadius: 22
	},
	mark: {
		alignItems: 'center',
		borderRadius: 16,
		elevation: 6,
		height: 52,
		justifyContent: 'center',
		shadowOffset: { height: 8, width: 0 },
		shadowOpacity: 0.26,
		shadowRadius: 11,
		width: 52
	},
	title: {
		lineHeight: 27.6
	}
});
