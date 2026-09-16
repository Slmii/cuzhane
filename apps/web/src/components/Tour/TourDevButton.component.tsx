import { Icon } from '@/components/ui/Icon/Icon.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet } from 'react-native';
import { useTour } from './Tour.context';

/**
 * A disc that opens the first-use tour on demand, **in development builds only**.
 *
 * Replaying the tour otherwise means either tapping through Profil or setting `hasSeenTour`
 * back to false in the database and cold-starting, which is about fifty seconds a try while the
 * tour is being worked on. The call site guards this with `__DEV__`, so it is dropped from every
 * release bundle and nothing about the shipped screen changes.
 *
 * The reader's own way back in is the "Uygulama turu · Tekrar izle" row on Profil, and that is
 * the one that ships. If this ever wants to be a real control it needs a design, not a promotion.
 */
export const TourDevButton = () => {
	const { start } = useTour();
	const { theme } = useThemeContext();

	return (
		<Pressable
			accessibilityLabel='Start the tour (dev)'
			accessibilityRole='button'
			onPress={start}
			style={({ pressed }) => [
				styles.button,
				{
					backgroundColor: theme.colors.accent,
					borderColor: toAlphaColor(theme.colors.onHeaderSurface, 0.3),
					opacity: pressed ? 0.75 : 1,
					shadowColor: theme.colors.text
				}
			]}
		>
			<Icon color={theme.colors.onAccent} name='play' size={20} strokeWidth={2} />
		</Pressable>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		borderRadius: 24,
		borderWidth: 1,
		// Clear of the bar's own trailing disc, which on iOS is the detached search button.
		bottom: 84,
		elevation: 8,
		height: 48,
		justifyContent: 'center',
		position: 'absolute',
		right: 18,
		shadowOffset: { height: 8, width: 0 },
		shadowOpacity: 0.22,
		shadowRadius: 12,
		width: 48
	}
});
