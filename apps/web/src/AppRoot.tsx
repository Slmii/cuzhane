import { NotificationOrchestrator } from '@/components/NotificationOrchestrator/NotificationOrchestrator.component';
import { ClerkProvider } from '@/lib/context/ClerkProvider.context';
import { useAppFocusSync } from '@/lib/hooks/useAppFocusSync';
import { useAuthTokenSync } from '@/lib/hooks/useAuthTokenSync';
import { I18nProvider } from '@/lib/i18n/I18n.context';
import { buildNavigationTheme } from '@/lib/theme/navigationTheme';
import { ThemeProvider, useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { AppNavigator } from '@/navigation/AppNavigator';
import { linking } from '@/navigation/linking';
import { navigationRef } from '@/navigation/navigationRef';
import { OnboardingDevTrigger } from '@/screens/Onboarding/OnboardingDevTrigger.component';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
	Manrope_400Regular,
	Manrope_500Medium,
	Manrope_600SemiBold,
	Manrope_700Bold
} from '@expo-google-fonts/manrope';
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { NotoNaskhArabic_400Regular, NotoNaskhArabic_500Medium } from '@expo-google-fonts/noto-naskh-arabic';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { ScheherazadeNew_400Regular } from '@expo-google-fonts/scheherazade-new';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
			<KeyboardProvider>
				<BottomSheetModalProvider>
					<NavigationContainer linking={linking} ref={navigationRef} theme={navigationTheme}>
						<StatusBar style={theme.mode === 'dark' || isSplashVisible ? 'light' : 'dark'} />
						<AppNavigator />
						<NotificationOrchestrator />
						<OnboardingDevTrigger />
						{/*
						 * Over the app rather than in front of it: the navigator mounts and starts
						 * fetching underneath, so the splash is spending time the app needed
						 * anyway instead of adding to it.
						 */}
						{isSplashVisible ? <AnimatedSplash /> : null}
					</NavigationContainer>
				</BottomSheetModalProvider>
			</KeyboardProvider>
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
		 * The reader's Arabic. The Naskh medium is the ornament numeral; the three regulars
		 * are the faces E2a offers for the text itself.
		 *
		 * All four load up front with everything else rather than on demand when someone picks
		 * one — they are what the splash is already waiting on, and a face arriving after the
		 * page did would reflow a screen of Arabic under the reader's eyes.
		 */
		NotoNaskhArabic_500Medium,
		NotoNaskhArabic_400Regular,
		AmiriQuran_400Regular,
		ScheherazadeNew_400Regular
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
