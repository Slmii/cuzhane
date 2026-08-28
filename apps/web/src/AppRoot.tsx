import { NotificationOrchestrator } from '@/components/NotificationOrchestrator/NotificationOrchestrator.component';
import { ClerkProvider } from '@/lib/context/ClerkProvider.context';
import { useAppFocusSync } from '@/lib/hooks/useAppFocusSync';
import { useAuthTokenSync } from '@/lib/hooks/useAuthTokenSync';
import { I18nProvider } from '@/lib/i18n/I18n.context';
import { buildNavigationTheme } from '@/lib/theme/navigationTheme';
import { ThemeProvider, useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { AppNavigator } from '@/navigation/AppNavigator';
import { linking } from '@/navigation/linking';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
	Manrope_400Regular,
	Manrope_500Medium,
	Manrope_600SemiBold,
	Manrope_700Bold
} from '@expo-google-fonts/manrope';
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
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

const AppContainer = () => {
	const { theme } = useThemeContext();
	useAuthTokenSync();
	useAppFocusSync();

	const navigationTheme = useMemo(() => buildNavigationTheme(theme), [theme]);

	return (
		<GestureHandlerRootView style={[styles.root, { backgroundColor: theme.colors.background }]}>
			<KeyboardProvider>
				<BottomSheetModalProvider>
					<NavigationContainer linking={linking} theme={navigationTheme}>
						<StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
						<AppNavigator />
						<NotificationOrchestrator />
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
		IBMPlexMono_500Medium
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
