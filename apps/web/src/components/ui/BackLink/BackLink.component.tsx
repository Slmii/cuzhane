import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet } from 'react-native';
import type { BackLinkProps } from './BackLink.types';

const BACK_ICON_SIZE = 15;

/** Chevron + "Geri", the design's back affordance. Used by every pushed screen. */
export const BackLink = ({ label, onPress, style }: BackLinkProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<Pressable accessibilityRole='button' onPress={onPress} style={[styles.row, style]}>
			<Icon color={theme.colors.subtext} name='back' size={BACK_ICON_SIZE} />
			<Typography color={theme.colors.subtext} variant='bodyStrong'>
				{label ?? t('back')}
			</Typography>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		alignSelf: 'flex-start',
		flexDirection: 'row',
		gap: 5
	}
});
