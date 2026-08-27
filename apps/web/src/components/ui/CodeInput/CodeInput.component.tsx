import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CodeInputProps } from './CodeInput.types';

export const CodeInput = ({ hasError = false, length = 8, onPress, style, value }: CodeInputProps) => {
	const { theme } = useThemeContext();

	const boxes = Array.from({ length }, (_, index) => {
		const character = value[index];
		const isFilled = character !== undefined;
		const isCursor = !isFilled && index === value.length && index < length;

		let borderColor = theme.colors.border;

		if (hasError) {
			borderColor = theme.colors.danger;
		} else if (isCursor) {
			borderColor = theme.colors.accent;
		}

		return (
			<View
				key={index}
				style={[
					styles.box,
					{
						backgroundColor: isFilled ? theme.colors.surface : theme.colors.inputBackground,
						borderColor
					}
				]}
			>
				{isFilled ? <Typography variant='title'>{character}</Typography> : null}
			</View>
		);
	});

	if (onPress) {
		return (
			<Pressable
				accessibilityRole='button'
				onPress={onPress}
				style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }, style]}
			>
				{boxes}
			</Pressable>
		);
	}

	return <View style={[styles.row, style]}>{boxes}</View>;
};

const styles = StyleSheet.create({
	box: {
		alignItems: 'center',
		aspectRatio: 0.78,
		borderRadius: 11,
		borderWidth: 1.5,
		flex: 1,
		justifyContent: 'center'
	},
	row: {
		flexDirection: 'row',
		gap: 6
	}
});
