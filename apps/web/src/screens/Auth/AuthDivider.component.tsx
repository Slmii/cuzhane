import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * "or" rule between the social buttons and the email form — shared by sign-in and sign-up.
 * The two screens sit it at different distances from the form (18 on 01A, 16 on 01B), so
 * the gap below is the caller's to set rather than baked in here.
 */
export const AuthDivider = ({ style }: { style?: StyleProp<ViewStyle> }) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<View style={[styles.container, style]}>
			<View style={[styles.line, { backgroundColor: theme.colors.divider }]} />
			<Typography color={theme.colors.faintText} style={styles.label}>
				{t('or')}
			</Typography>
			<View style={[styles.line, { backgroundColor: theme.colors.divider }]} />
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	label: {
		fontSize: 10.5,
		letterSpacing: 0.85,
		lineHeight: 14,
		textTransform: 'uppercase'
	},
	line: {
		flex: 1,
		height: StyleSheet.hairlineWidth
	}
});
