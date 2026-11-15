import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet } from 'react-native';
import type { OptionCardProps } from './OptionCard.types';

export const OptionCard = ({ hint, isSelected, onPress, style, title }: OptionCardProps) => {
	const { theme } = useThemeContext();

	return (
		<Pressable
			// Named outright: iOS doesn't gather a pressable's text into its label, so VoiceOver
			// said only "radio button". The hint goes in the label, not `accessibilityHint` — it
			// carries the option's facts ("11 ve 12 senin kalır"), which hints-off would drop.
			// A radio's on-state is `checked`, not `selected`.
			accessibilityLabel={hint ? `${title}, ${hint}` : title}
			accessibilityRole='radio'
			accessibilityState={{ checked: isSelected }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: isSelected ? theme.colors.accentSoft : theme.colors.surface,
					// The design tints an unselected card's border toward the accent on
					// hover; on touch the equivalent moment is the press itself.
					borderColor: isSelected
						? theme.colors.accent
						: pressed
						? theme.colors.accentMid
						: theme.colors.border,
					borderRadius: theme.radius.md,
					transform: [{ translateY: pressed ? -2 : 0 }]
				},
				style
			]}
		>
			<BodyStrongText>{title}</BodyStrongText>
			{hint ? (
				<CaptionText color={theme.colors.subtext} style={styles.hint}>
					{hint}
				</CaptionText>
			) : null}
		</Pressable>
	);
};

const styles = StyleSheet.create({
	card: {
		borderWidth: 1.5,
		padding: 14
	},
	hint: {
		fontSize: 10.5,
		lineHeight: 15,
		marginTop: 4
	}
});
