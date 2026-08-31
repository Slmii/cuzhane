import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ChipProps, ChipTone } from './Chip.types';

export const Chip = ({ icon, isSelected = false, label, onPress, style, tone = 'neutral' }: ChipProps) => {
	const { theme } = useThemeContext();

	const toneMap: Record<ChipTone, { backgroundColor: string; borderColor: string; textColor: string }> = {
		accent: {
			backgroundColor: theme.colors.accentSoft,
			borderColor: theme.colors.accentSoft,
			textColor: theme.colors.accent
		},
		accentOutline: {
			backgroundColor: theme.colors.transparent,
			borderColor: theme.colors.accentOutline,
			textColor: theme.colors.accent
		},
		missed: {
			backgroundColor: theme.colors.missedSurface,
			borderColor: theme.colors.missedSurface,
			textColor: theme.colors.missed
		},
		sand: {
			backgroundColor: theme.colors.sand,
			borderColor: theme.colors.sand,
			textColor: theme.colors.sandText
		},
		neutral: {
			backgroundColor: theme.colors.track,
			borderColor: theme.colors.track,
			textColor: theme.colors.subtext
		},
		outline: {
			backgroundColor: theme.colors.surface,
			borderColor: theme.colors.border,
			textColor: theme.colors.subtext
		},
		inverse: {
			backgroundColor: theme.colors.primary,
			borderColor: theme.colors.primary,
			textColor: theme.colors.onPrimary
		}
	};

	const resolvedTone = isSelected ? toneMap.inverse : toneMap[tone];

	const content = (
		<View
			style={[
				styles.chip,
				{
					backgroundColor: resolvedTone.backgroundColor,
					borderColor: resolvedTone.borderColor,
					borderRadius: theme.radius.sm - 2
				},
				style
			]}
		>
			{/* 12, not the icon's 21 default: it sits on a 10pt line and has to read as part of
			    the word rather than as a badge stuck on the front of it. */}
			{icon ? <Icon color={resolvedTone.textColor} name={icon} size={12} strokeWidth={1.7} /> : null}
			<Typography color={resolvedTone.textColor} style={styles.label} variant='stat' weight='semibold'>
				{label}
			</Typography>
		</View>
	);

	if (!onPress) {
		return content;
	}

	return (
		<Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
			{content}
		</Pressable>
	);
};

const styles = StyleSheet.create({
	chip: {
		alignItems: 'center',
		alignSelf: 'flex-start',
		flexDirection: 'row',
		gap: 4,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 8,
		paddingVertical: 4
	},
	label: {
		fontSize: 10,
		letterSpacing: 0.6
	}
});
