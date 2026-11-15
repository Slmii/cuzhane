import { AppSwitch } from '@/components/ui/Switch/Switch.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { ToggleRowProps } from './ToggleRow.types';

export const ToggleRow = ({
	disabled = false,
	footer,
	hint,
	onBlur,
	onValueChange,
	style,
	title,
	value
}: ToggleRowProps) => {
	const { theme } = useThemeContext();
	const row = (
		<View style={[styles.row, footer ? styles.rowWithFooter : null, footer ? null : style]}>
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

	return footer ? (
		<View style={style}>
			{row}
			<View style={styles.footer}>{footer}</View>
		</View>
	) : (
		row
	);
};

const styles = StyleSheet.create({
	footer: {
		paddingBottom: 15,
		paddingHorizontal: 15
	},
	hint: {
		marginTop: 2
	},
	// The footer carries the row's bottom padding instead, so the two read as one row.
	rowWithFooter: {
		paddingBottom: 10
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
