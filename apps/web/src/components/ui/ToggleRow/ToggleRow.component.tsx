import { AppSwitch } from '@/components/ui/Switch/Switch.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { ToggleRowProps } from './ToggleRow.types';

export const ToggleRow = ({ disabled = false, hint, onBlur, onValueChange, style, title, value }: ToggleRowProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.row, style]}>
			<View style={styles.textColumn}>
				<BodyStrongText>{title}</BodyStrongText>
				{hint ? (
					<CaptionText color={theme.colors.subtext} style={styles.hint}>
						{hint}
					</CaptionText>
				) : null}
			</View>
			<AppSwitch disabled={disabled} onBlur={onBlur} onValueChange={onValueChange} value={value} />
		</View>
	);
};

const styles = StyleSheet.create({
	hint: {
		marginTop: 2
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		padding: 15
	},
	textColumn: {
		flex: 1
	}
});
