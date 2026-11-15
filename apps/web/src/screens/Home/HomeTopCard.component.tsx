import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import type { HomeTopCardProps } from './HomeTopCard.types';

/** The design's drop shadow under the card, `0 10px 28px -14px` at 45%. */
const SHADOW_ALPHA = 0.45;

/**
 * The card that rides on Ana sayfa's coloured layer — "Sıradaki", "Bugünün payı" or "İlk adım".
 *
 * **Not a `CardSurface`.** It is the one solid card on the green: glass would take the green
 * into it, and `CardSurface` clips its own shadow and keeps its radius at 18 where the frame
 * draws 20 with a deep drop shadow. Its fill is the theme's `card`, so it goes dark with the
 * theme.
 */
export const HomeTopCard = ({ children, onPress }: HomeTopCardProps) => {
	const { theme } = useThemeContext();
	const surface = [
		styles.card,
		{
			backgroundColor: theme.colors.card,
			boxShadow: `0 10px 28px -14px ${toAlphaColor(theme.colors.scrim, SHADOW_ALPHA)}`
		}
	];

	return onPress ? (
		<Pressable
			accessibilityRole='button'
			onPress={onPress}
			style={({ pressed }) => [surface, pressed && styles.pressed]}
		>
			{children}
		</Pressable>
	) : (
		<View style={surface}>{children}</View>
	);
};

const styles = StyleSheet.create({
	card: {
		borderRadius: 20,
		gap: 12,
		paddingBottom: 16,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	pressed: {
		opacity: 0.94
	}
});
