import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { AppTheme, darkTheme, lightTheme, ResolvedThemeMode, ThemeMode } from './tokens';

type ThemeContextValue = {
	/** The stored preference, including `'system'`. The Görünüm control binds to this. */
	mode: ThemeMode;
	/** What that preference resolves to right now. Anything picking a colour wants this one. */
	resolvedMode: ResolvedThemeMode;
	theme: AppTheme;
	setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_MODE_STORAGE_KEY = 'cuzhane.theme-mode';

const isThemeMode = (value: string | null): value is ThemeMode =>
	value === 'light' || value === 'dark' || value === 'system';

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

	/**
	 * **The app's appearance is told to the platform, not just to our own components.**
	 *
	 * Everything drawn from `theme.colors` obeys Görünüm — but the controls handed to the
	 * platform don't, because they don't read our tokens. They read the *system* appearance, and
	 * the two can disagree: with the phone in dark mode and the app set to Açık, the segmented
	 * control rendered its dark-mode palette — near-white labels on the light grey track, which
	 * is unreadable, and exactly the state the appearance row itself is drawn in.
	 *
	 * `setColorScheme` overrides the trait collection for the whole app, so the segmented
	 * control, the switch, the reader's slider and the tab bar all resolve their system colours
	 * against the theme someone actually chose. One call rather than a `colorScheme` prop
	 * threaded through every native control, which is a thing to forget on the next one.
	 *
	 * **`'unspecified'` is the value that means "stop overriding"**, not `null`. React Native
	 * special-cases it: passing `'unspecified'` clears the override *and* re-reads the real
	 * system scheme into the value `useColorScheme` reports, synchronously. Passing null instead
	 * would leave that cache holding null, and the resolve below would read the wrong side.
	 */
	useEffect(() => {
		if (!isHydrated) {
			return;
		}

		Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
	}, [isHydrated, mode]);

	/*
	 * With the override cleared this is the device's own appearance, which is exactly what
	 * `'system'` should follow. With an override set it simply echoes it back, so the branch
	 * below never consults it — no need to tell the two cases apart.
	 */
	const systemScheme = useColorScheme();

	const value = useMemo(() => {
		const resolvedMode: ResolvedThemeMode = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

		return {
			mode,
			resolvedMode,
			theme: resolvedMode === 'dark' ? darkTheme : lightTheme,
			setMode
		};
	}, [mode, systemScheme]);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error('useThemeContext must be used inside ThemeProvider.');
	}

	return context;
};
