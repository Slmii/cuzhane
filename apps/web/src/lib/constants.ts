import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

const LOCAL_HOST_PATTERN = /(?:localhost|127\.0\.0\.1)/;

const resolveDevHost = () => {
	// Preferred: Expo's hostUri ("192.168.x.x:8081"). Available in dev client + Expo Go.
	const hostUri = Constants.expoConfig?.hostUri;
	if (hostUri) {
		const hostname = hostUri.split(':')[0];
		if (hostname) {
			return hostname;
		}
	}

	// Fallback for older RN behavior.
	const scriptUrl = NativeModules?.SourceCode?.scriptURL as string | undefined;

	if (!scriptUrl) {
		return null;
	}

	try {
		return new URL(scriptUrl).hostname;
	} catch {
		return null;
	}
};

const withResolvedHost = (rawBaseUrl: string) => {
	if (!LOCAL_HOST_PATTERN.test(rawBaseUrl)) {
		return rawBaseUrl;
	}

	const devHost = resolveDevHost();
	if (!devHost) {
		return rawBaseUrl;
	}

	return rawBaseUrl.replace(LOCAL_HOST_PATTERN, devHost);
};

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export const API_BASE_URL = withResolvedHost(configuredBaseUrl).replace(/\/$/, '');
