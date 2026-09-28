import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet } from 'react-native';
import type { FlatButtonProps } from './FlatButton.types';

/**
 * The design's drawn buttons on the Hizb plan card and in its reader (R1–R4, T1d): a flat
 * rounded rectangle, never the platform's glass pill `AppButton` becomes on iOS — the design
 * sets these by the pixel, so they are drawn the same on both platforms.
 */
export const FlatButton = ({
	accessibilityLabel,
	disabled = false,
	icon,
	onPress,
	style,
	title,
	variant
}: FlatButtonProps) => {
	const { theme } = useThemeContext();
	const tone = {
		ink: { background: theme.colors.primary, text: theme.colors.onPrimary, size: 13.5, padding: 15 },
		// `segmentTrack`, not `surfaceMuted`: in dark mode `surfaceMuted` is the card's own colour,
		// so the grey button would vanish into it.
		muted: { background: theme.colors.segmentTrack, text: theme.colors.text, size: 13, padding: 13 },
		accent: { background: theme.colors.accent, text: theme.colors.onAccent, size: 13, padding: 13 },
		link: { background: theme.colors.transparent, text: theme.colors.accent, size: 12.5, padding: 4 }
	}[variant];
	// A dark button that is not ready yet is the design's pale grey, not a faded black (T1d's
	// "Sonraki sayfa" before the target).
	const isWaitingInk = variant === 'ink' && disabled;
	const background = isWaitingInk ? theme.colors.progressTrack : tone.background;
	const text = isWaitingInk ? toAlphaColor(theme.colors.text, 0.4) : tone.text;

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel ?? title}
			accessibilityRole='button'
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				{
					backgroundColor: background,
					opacity: disabled && !isWaitingInk ? 0.45 : pressed ? 0.8 : 1,
					paddingVertical: tone.padding
				},
				style
			]}
		>
			{icon ? <Icon color={text} name={icon} size={16} strokeWidth={1.8} /> : null}
			<Typography color={text} style={[styles.label, { fontSize: tone.size }]} weight='semibold'>
				{title}
			</Typography>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	base: {
		alignItems: 'center',
		borderRadius: 15,
		flexDirection: 'row',
		gap: 7,
		justifyContent: 'center',
		paddingHorizontal: 13
	},
	label: {
		lineHeight: 18
	}
});
