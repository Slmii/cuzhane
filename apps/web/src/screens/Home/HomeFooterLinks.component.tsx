import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';

/**
 * "Serbest Cevşen · Mushaf" — reading outside any group, at the foot of Ana sayfa's sheet in
 * every state, the skeleton's included. Pinned to the bottom by `marginTop: 'auto'` inside a
 * column that grows to the sheet's height.
 */
export const HomeFooterLinks = () => {
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const link = (label: string, onPress: () => void) => (
		<Pressable accessibilityRole='link' hitSlop={10} onPress={onPress}>
			{({ pressed }) => (
				<Typography
					color={theme.colors.accent}
					style={[styles.link, pressed ? styles.pressed : null]}
					weight='semibold'
				>
					{label}
				</Typography>
			)}
		</Pressable>
	);

	return (
		<View style={styles.row}>
			{link(t('homeFreeCevsen'), () => navigation.navigate('AllBabs'))}
			{/* A separator for the eye only; a screen reader moves between the two links without it. */}
			<View accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
				<Typography color={toAlphaColor(theme.colors.text, 0.25)} style={styles.link}>
					·
				</Typography>
			</View>
			{link(t('homeMushaf'), () => navigation.navigate('Mushaf'))}
		</View>
	);
};

const styles = StyleSheet.create({
	link: {
		fontSize: 11,
		lineHeight: 15
	},
	pressed: {
		opacity: 0.6
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14,
		justifyContent: 'center',
		marginTop: 'auto',
		paddingTop: 14
	}
});
