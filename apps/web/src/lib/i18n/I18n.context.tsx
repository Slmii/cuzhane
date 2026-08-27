import { AppLanguage, interpolate, isAppLanguage, StringKey, STRINGS } from '@/lib/i18n/strings';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

type I18nContextValue = {
	language: AppLanguage;
	setLanguage: (language: AppLanguage) => void;
	t: Translate;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const LANGUAGE_STORAGE_KEY = 'cuzhane.language';
const DEFAULT_LANGUAGE: AppLanguage = 'tr';

const readStoredLanguage = async (): Promise<AppLanguage | null> => {
	if (Platform.OS === 'web') {
		if (typeof localStorage === 'undefined') {
			return null;
		}

		const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		return isAppLanguage(value) ? value : null;
	}

	const value = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
	return isAppLanguage(value) ? value : null;
};

const writeStoredLanguage = async (language: AppLanguage) => {
	if (Platform.OS === 'web') {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
		}

		return;
	}

	await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, language);
};

type I18nProviderProps = {
	children: ReactNode;
};

export const I18nProvider = ({ children }: I18nProviderProps) => {
	const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const hydrateLanguage = async () => {
			try {
				const storedLanguage = await readStoredLanguage();

				if (isMounted && storedLanguage) {
					setLanguage(storedLanguage);
				}
			} catch {
				// Ignore storage failures and keep the default language.
			} finally {
				if (isMounted) {
					setIsHydrated(true);
				}
			}
		};

		hydrateLanguage();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!isHydrated) {
			return;
		}

		writeStoredLanguage(language).catch(() => {
			// Ignore storage failures and keep the in-memory language.
		});
	}, [isHydrated, language]);

	const t = useCallback<Translate>((key, values) => interpolate(STRINGS[language][key], values), [language]);

	const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
	const context = useContext(I18nContext);

	if (!context) {
		throw new Error('useTranslation must be used inside I18nProvider.');
	}

	return context;
};
