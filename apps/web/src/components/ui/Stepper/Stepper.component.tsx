import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StepperProps } from './Stepper.types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const Stepper = ({ caption, max = 50, min = 5, onChange, step = 5, style, value }: StepperProps) => {
	const { theme } = useThemeContext();
	const isMinDisabled = value <= min;
	const isMaxDisabled = value >= max;

	const handleChange = (delta: number) => {
		onChange(clamp(value + delta, min, max));
	};

	return (
		<View accessibilityRole='adjustable' style={[styles.row, style]}>
			<Pressable
				accessibilityRole='button'
				disabled={isMinDisabled}
				onPress={() => handleChange(-step)}
				style={[
					styles.button,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.border,
						opacity: isMinDisabled ? 0.4 : 1
					}
				]}
			>
				<Icon name='minus' size={17} />
			</Pressable>
			<View style={styles.centerColumn}>
				<Typography color={theme.colors.accent} style={styles.value} variant='display'>
					{value}
				</Typography>
				{caption ? (
					<CaptionText color={theme.colors.faintText} style={styles.caption} textAlign='center'>
						{caption}
					</CaptionText>
				) : null}
			</View>
			<Pressable
				accessibilityRole='button'
				disabled={isMaxDisabled}
				onPress={() => handleChange(step)}
				style={[
					styles.button,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.border,
						opacity: isMaxDisabled ? 0.4 : 1
					}
				]}
			>
				<Icon name='plus' size={17} />
			</Pressable>
		</View>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: 1,
		height: 36,
		justifyContent: 'center',
		width: 36
	},
	caption: {
		fontSize: 10.5,
		marginTop: 5
	},
	centerColumn: {
		alignItems: 'center'
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	value: {
		fontSize: 34,
		lineHeight: 36
	}
});
