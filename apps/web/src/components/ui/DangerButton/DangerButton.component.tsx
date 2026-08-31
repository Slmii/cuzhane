import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { DangerButtonProps } from './DangerButton.types';

/**
 * The look of a destructive action — outlined in the danger colour, filled when armed,
 * with an optional line underneath saying what it costs.
 *
 * Only the look. How the action is confirmed is the caller's business: deleting a group
 * arms this button as its own confirmation, while leaving one raises the platform dialog.
 */
export const DangerButton = ({
	hint,
	icon,
	isDisabled = false,
	isFilled = false,
	label,
	onPress,
	style
}: DangerButtonProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={style}>
			<Pressable
				accessibilityHint={hint}
				accessibilityRole='button'
				accessibilityState={{ disabled: isDisabled }}
				disabled={isDisabled}
				onPress={onPress}
				style={({ pressed }) => [
					styles.button,
					{
						backgroundColor: isFilled ? theme.colors.danger : theme.colors.surface,
						borderColor: theme.colors.danger,
						opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1
					}
				]}
			>
				{icon ? (
					<Icon
						color={isFilled ? theme.colors.onDanger : theme.colors.danger}
						name={icon}
						size={18}
						strokeWidth={1.8}
					/>
				) : null}
				<Typography color={isFilled ? theme.colors.onDanger : theme.colors.danger} variant='bodyStrong'>
					{label}
				</Typography>
			</Pressable>
			{hint ? (
				<CaptionText color={theme.colors.faintText} style={styles.hint}>
					{hint}
				</CaptionText>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center',
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		paddingVertical: 15
	},
	hint: {
		fontSize: 11,
		lineHeight: 17,
		marginTop: 8,
		paddingHorizontal: 2
	}
});
