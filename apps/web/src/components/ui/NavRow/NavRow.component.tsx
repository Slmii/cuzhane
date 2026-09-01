import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NavRowProps } from './NavRow.types';

export const NavRow = ({ label, leading, meta, onPress, style }: NavRowProps) => {
	const { theme } = useThemeContext();

	return (
		<Pressable accessibilityRole='button' onPress={onPress} style={[styles.row, style]}>
			<View style={styles.leftGroup}>
				{leading}
				<BodyStrongText>{label}</BodyStrongText>
			</View>
			<View style={styles.rightGroup}>
				{meta ? <CaptionText color={theme.colors.faintText}>{meta}</CaptionText> : null}
				<Icon color={theme.colors.faintText} name='chevronRight' size={15} />
			</View>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	leftGroup: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	rightGroup: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		padding: 15
	}
});
