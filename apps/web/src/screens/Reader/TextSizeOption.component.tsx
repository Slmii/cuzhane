import { Typography } from '@/components/ui/Typography/Typography.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
	isSelected: boolean;
	label: string;
	onPress: () => void;
	sample: number;
};

export const TextSizeOption = ({ isSelected, label, onPress, sample }: Props) => {
	const { theme } = useThemeContext();

	return (
		<Pressable
			accessibilityRole='button'
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{
					backgroundColor: isSelected ? theme.colors.accentSoft : theme.colors.surface,
					borderColor: isSelected ? theme.colors.accent : theme.colors.border,
					opacity: pressed ? 0.9 : 1
				}
			]}
		>
			<Typography style={styles.label} variant='bodyStrong'>
				{label}
			</Typography>
			<Typography color={theme.colors.faintText} variant='mono'>
				{`${sample}px`}
			</Typography>
			<View style={styles.mark}>
				{isSelected ? <Icon color={theme.colors.accent} name='check' size={14} /> : null}
			</View>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	label: {
		flex: 1
	},
	mark: {
		alignItems: 'flex-end',
		width: 16
	},
	markGlyph: {
		fontSize: 12
	},
	row: {
		alignItems: 'center',
		borderRadius: 15,
		borderWidth: 1.5,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 14
	}
});
