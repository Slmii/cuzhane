import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { AppTheme, darkTheme, lightTheme, ThemeMode } from './tokens';

type ThemeContextValue = {
	mode: ThemeMode;
	theme: AppTheme;
	setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_MODE_STORAGE_KEY = 'cuzhane.theme-mode';

const isThemeMode = (value: string | null): value is ThemeMode => value === 'light' || value === 'dark';

const readStoredThemeMode = async (): Promise<ThemeMode | null> => {
	if (Platform.OS === 'web') {
		if (typeof localStorage === 'undefined') {
			return null;
		}

		const value = localStorage.getItem(THEME_MODE_STORAGE_KEY);
		return isThemeMode(value) ? value : null;
	}

	const value = await SecureStore.getItemAsync(THEME_MODE_STORAGE_KEY);
	return isThemeMode(value) ? value : null;
};

const writeStoredThemeMode = async (mode: ThemeMode) => {
	if (Platform.OS === 'web') {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
		}

		return;
	}

	await SecureStore.setItemAsync(THEME_MODE_STORAGE_KEY, mode);
};

type ThemeProviderProps = {
	children: ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
	const [mode, setMode] = useState<ThemeMode>('light');
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const hydrateTheme = async () => {
			try {
				const storedMode = await readStoredThemeMode();

				if (isMounted && storedMode) {
					setMode(storedMode);
				}
			} catch {
				// Ignore storage failures and keep default light theme.
			} finally {
				if (isMounted) {
					setIsHydrated(true);
				}
			}
		};

		hydrateTheme();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!isHydrated) {
			return;
		}

		writeStoredThemeMode(mode).catch(() => {
			// Ignore storage failures and keep in-memory theme mode.
		});
	}, [isHydrated, mode]);

	const value = useMemo(
		() => ({
			mode,
			theme: mode === 'dark' ? darkTheme : lightTheme,
			setMode
		}),
		[mode]
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error('useThemeContext must be used inside ThemeProvider.');
	}

	return context;
};
