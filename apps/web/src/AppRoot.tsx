import { NotificationOrchestrator } from '@/components/NotificationOrchestrator/NotificationOrchestrator.component';
import { DestructiveDialog } from '@/components/ui/DestructiveDialog/DestructiveDialog.component';
import { ClerkProvider } from '@/lib/context/ClerkProvider.context';
import { useAppFocusSync } from '@/lib/hooks/useAppFocusSync';
import { useAuthTokenSync } from '@/lib/hooks/useAuthTokenSync';
import { I18nProvider } from '@/lib/i18n/I18n.context';
import { buildNavigationTheme } from '@/lib/theme/navigationTheme';
import { ThemeProvider, useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { AppNavigator } from '@/navigation/AppNavigator';
import { AppStatusBar } from '@/navigation/AppStatusBar';
import { linking } from '@/navigation/linking';
import { navigationRef } from '@/navigation/navigationRef';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
	Manrope_400Regular,
	Manrope_500Medium,
	Manrope_600SemiBold,
	Manrope_700Bold
} from '@expo-google-fonts/manrope';
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { NotoNaskhArabic_500Medium } from '@expo-google-fonts/noto-naskh-arabic';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
// Aliased: `SplashScreen` above is Expo's native-splash controller, this is the animated
// brand screen that takes over once it hides.
import { SplashScreen as AnimatedSplash } from '@/screens/Splash/SplashScreen.component';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

/**
 * Without this a reminder that fires while the app is open is delivered silently — iOS
 * suppresses banners for the foreground app unless it's told otherwise. Set at module
 * scope, before any component mounts, because a notification can arrive at any moment.
 */
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldPlaySound: true,
		shouldSetBadge: false,
		shouldShowBanner: true,
		shouldShowList: true
	})
});

/**
 * How long the animated splash is held. The mark's columns alone take ~940ms to finish
 * growing, so anything shorter cuts the brand off mid-gesture — and on a warm start the app
 * is ready long before the animation is.
 */
const SPLASH_MIN_DURATION_MS = 2000;

const AppContainer = () => {
	const { theme } = useThemeContext();
	const [isSplashVisible, setIsSplashVisible] = useState(true);
	useAuthTokenSync();
	useAppFocusSync();

	const navigationTheme = useMemo(() => buildNavigationTheme(theme), [theme]);

	useEffect(() => {
		const timeout = setTimeout(() => setIsSplashVisible(false), SPLASH_MIN_DURATION_MS);

		return () => clearTimeout(timeout);
	}, []);

	return (
		<GestureHandlerRootView style={[styles.root, { backgroundColor: theme.colors.background }]}>
			{/*
			 * No sheet provider here any more. `AppBottomSheet` is the platform's own sheet, which
			 * is presented by the OS rather than rendered into a host somewhere up this tree —
			 * `@expo/ui` keeps a `BottomSheetModalProvider` export only so gorhom's can be deleted
			 * without touching the file it sat in, and it renders its children and nothing else.
			 */}
			{/*
			 * **The safe area belongs to the app, not to the navigators.** Every screen used to
			 * get its insets from React Navigation's `SafeAreaProviderCompat`, which each
			 * navigator renders around its own scenes — so anything drawn *outside* a navigator
			 * had no provider above it and `useSafeAreaInsets` threw "No safe area value
			 * available", an unhandled JS exception that abort()s the app in release. That is
			 * precisely what `AppNavigator`'s gate does: `HomeSkeleton` while the settings load
			 * after sign-in, and `ErrorState` when they fail, are both full screens standing in
			 * for the navigator rather than inside it. Diagnosed from the device's expo-updates
			 * log (`Library/Application Support/dev.expo.modules.core.logging.expo-updates.txt`),
			 * which keeps the JS message the crash report reduces to "abort() called".
			 *
			 * `initialMetrics` is what keeps this free: with the window's insets known
			 * synchronously the provider has nothing to measure, so it renders its children on
			 * the first frame instead of after a layout pass — and the compat providers inside
			 * each navigator find a context already in place and step aside.
			 */}
			<SafeAreaProvider initialMetrics={initialWindowMetrics}>
				<KeyboardProvider>
					<NavigationContainer linking={linking} ref={navigationRef} theme={navigationTheme}>
						<AppStatusBar isSplashVisible={isSplashVisible} />
						<AppNavigator />
						{/* Renders nothing until something calls `confirmDestructive`, and nothing at
					    all off Android — iOS takes `Alert.alert`. Mounted here because Android
					    presents it in a window of its own, which is what lets the two callers
					    that live inside bottom sheets reach it from the root. */}
						<DestructiveDialog />
						<NotificationOrchestrator />
						{/*
						 * Over the app rather than in front of it: the navigator mounts and starts
						 * fetching underneath, so the splash is spending time the app needed
						 * anyway instead of adding to it.
						 */}
						{isSplashVisible ? <AnimatedSplash /> : null}
					</NavigationContainer>
				</KeyboardProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
};

export const AppRoot = () => {
	const [isFontsLoaded, fontsError] = useFonts({
		Manrope_400Regular,
		Manrope_500Medium,
		Manrope_600SemiBold,
		Manrope_700Bold,
		Newsreader_400Regular,
		Newsreader_500Medium,
		Newsreader_600SemiBold,
		IBMPlexMono_400Regular,
		IBMPlexMono_500Medium,
		/*
		 * The reader's Arabic. The Naskh medium is the drawn rosette's numeral; the rest are
		 * the faces E2a offers for the text itself.
		 *
		 * All load up front with everything else rather than on demand when someone picks
		 * one — they are what the splash is already waiting on, and a face arriving after the
		 * page did would reflow a screen of Arabic under the reader's eyes.
		 */
		NotoNaskhArabic_500Medium,
		AmiriQuran_400Regular,
		// Local files rather than packages — see `arabicReaderFonts`.
		Kitab_400Regular: require('@/assets/fonts/Kitab-Regular.ttf'),
		UthmanicHafs_400Regular: require('@/assets/fonts/UthmanicHafs-Regular.otf')
	});

	useEffect(() => {
		if (isFontsLoaded || fontsError) {
			SplashScreen.hideAsync().catch(() => {});
		}
	}, [fontsError, isFontsLoaded]);

	if (!isFontsLoaded && !fontsError) {
		return null;
	}

	return (
		<ClerkProvider>
			<ThemeProvider>
				<I18nProvider>
					<QueryClientProvider client={queryClient}>
						<View style={styles.root}>
							<AppContainer />
						</View>
					</QueryClientProvider>
				</I18nProvider>
			</ThemeProvider>
		</ClerkProvider>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1
	}
});
