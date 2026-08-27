import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { ActivityIndicator, Pressable, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { AppButtonProps, ButtonSize } from './Button.types';

const sizeStyleMap: Record<ButtonSize, ViewStyle> = {
	sm: {
		borderRadius: 11,
		minHeight: 36,
		paddingHorizontal: 15,
		paddingVertical: 9
	},
	md: {
		borderRadius: 13,
		minHeight: 46,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	lg: {
		borderRadius: 15,
		minHeight: 54,
		paddingHorizontal: 18,
		paddingVertical: 17
	}
};

const labelSizeStyleMap: Record<ButtonSize, TextStyle> = {
	sm: { fontSize: 12, lineHeight: 16 },
	md: { fontSize: 12.5, lineHeight: 17 },
	lg: { fontSize: 13.5, lineHeight: 18 }
};

/** A shade above the label so the glyph reads as its equal, not as punctuation. */
const iconSizeMap: Record<ButtonSize, number> = {
	sm: 13,
	md: 14,
	lg: 15
};

export const AppButton = ({
	disabled = false,
	fullWidth = true,
	icon,
	isLoading = false,
	onPress,
	size = 'lg',
	style,
	title,
	variant = 'primary'
}: AppButtonProps) => {
	const { theme } = useThemeContext();

	const toneByVariant = {
		primary: {
			backgroundColor: theme.colors.primary,
			borderColor: theme.colors.primary,
			textColor: theme.colors.onPrimary
		},
		accent: {
			backgroundColor: theme.colors.accent,
			borderColor: theme.colors.accent,
			textColor: theme.colors.onAccent
		},
		accentOutline: {
			backgroundColor: theme.colors.transparent,
			borderColor: theme.colors.accent,
			textColor: theme.colors.accent
		},
		surface: {
			backgroundColor: theme.colors.surface,
			borderColor: theme.colors.borderStrong,
			textColor: theme.colors.text
		},
		danger: {
			backgroundColor: theme.colors.surface,
			borderColor: theme.colors.danger,
			textColor: theme.colors.danger
		},
		ghost: {
			backgroundColor: theme.colors.transparent,
			borderColor: theme.colors.transparent,
			textColor: theme.colors.subtext
		}
	}[variant];

	return (
		<Pressable
			disabled={disabled || isLoading}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				sizeStyleMap[size],
				{
					backgroundColor: toneByVariant.backgroundColor,
					borderColor: toneByVariant.borderColor,
					opacity: disabled || isLoading ? 0.45 : pressed ? 0.86 : 1,
					// Every button in the design dips slightly on press.
					transform: [{ scale: pressed && !disabled && !isLoading ? 0.96 : 1 }],
					width: fullWidth ? '100%' : undefined
				},
				style
			]}
		>
			{isLoading ? (
				<ActivityIndicator color={toneByVariant.textColor} size='small' />
			) : (
				<>
					{/* Leads the label, in the label's own colour — the row's `gap` already
					    spaces it. A confirmation like "Yapıştırıldı" is a tick and a word, and
					    the tick has to be the icon set's, never a ✓ typed into the string. */}
					{icon ? (
						<Icon color={toneByVariant.textColor} name={icon} size={iconSizeMap[size]} strokeWidth={1.9} />
					) : null}
					<Typography color={toneByVariant.textColor} style={labelSizeStyleMap[size]} variant='bodyStrong'>
						{title}
					</Typography>
				</>
			)}
		</Pressable>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center'
	}
});
