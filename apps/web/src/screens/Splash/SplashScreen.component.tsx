import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import * as NativeSplash from 'expo-splash-screen';
import { Image, StyleSheet, View } from 'react-native';

/** The design's near-black, which is darker than the app's own dark background. */
const DARK_BACKDROP = '#0C0D0C';
/** `imageWidth` of `expo-splash-screen` in `app.json` — the rosette must land where the native one was. */
const EMBLEM_SIZE = 288;

const NORMAL = require('@/assets/splash.png');
const DARK = require('@/assets/splash-dark.png');

/**
 * **The native splash goes only once this one's rosette is on screen.** Hidden any earlier, the
 * frame between showed the backdrop without it — a flicker. One frame after `onLoad`, so the
 * image has been drawn, not just decoded. On a failed load too, or the native splash would stay
 * up for good. Repeated calls (the splash mounts again as `SplashHold`) are harmless.
 */
const hideNativeSplash = () => {
	requestAnimationFrame(() => {
		NativeSplash.hideAsync().catch(() => {});
	});
};

/**
 * A0 · Açılış.
 *
 * The native splash, held: brand green — near-black in dark — with the rosette exactly where the
 * native screen drew it, and nothing moving, so the hand-over cannot be seen.
 */
export const SplashScreen = () => {
	const { theme } = useThemeContext();
	const isDark = theme.mode === 'dark';

	return (
		<View
			accessibilityLabel='Cüzhane'
			accessible
			style={[styles.root, { backgroundColor: isDark ? DARK_BACKDROP : theme.colors.accent }]}
		>
			<Image
				fadeDuration={0}
				onError={hideNativeSplash}
				onLoad={hideNativeSplash}
				source={isDark ? DARK : NORMAL}
				style={styles.emblem}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	emblem: {
		height: EMBLEM_SIZE,
		resizeMode: 'contain',
		width: EMBLEM_SIZE
	},
	root: {
		...StyleSheet.absoluteFill,
		alignItems: 'center',
		justifyContent: 'center',
		// Above the dev trigger, which sits at 9999: while the splash is up it is the only
		// thing that should be on screen.
		zIndex: 10_000
	}
});
