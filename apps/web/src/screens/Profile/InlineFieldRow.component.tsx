import { AppInput } from '@/components/ui/Input/Input.component';
import type { AppInputProps } from '@/components/ui/Input/Input.types';
import { BodyStrongText } from '@/components/ui/Typography/Typography.component';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

type Props = Pick<AppInputProps, 'autoCapitalize' | 'onBlur' | 'onChangeText' | 'textContentType' | 'value'> & {
	label: string;
};

/** Borderless inline text row for the profile name card — `AppInput`'s surface/muted variants always draw a box, which doesn't fit here. */
export const InlineFieldRow = ({ label, ...inputProps }: Props) => {
	const { theme } = useThemeContext();

	return (
		<View style={styles.row}>
			<BodyStrongText color={theme.colors.subtext} style={styles.label}>
				{label}
			</BodyStrongText>
			<AppInput
				{...inputProps}
				containerStyle={styles.inputContainer}
				style={[styles.input, { color: theme.colors.text }]}
				variant='ghost'
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	input: {
		borderWidth: 0,
		fontFamily: appFonts.regular,
		fontSize: 14,
		minHeight: 0,
		paddingHorizontal: 0,
		paddingVertical: 4
	},
	inputContainer: {
		flex: 1,
		minWidth: 0
	},
	label: {
		flex: 0,
		width: 78
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 12
	}
});
