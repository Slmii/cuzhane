import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { focusedRouteName } from '@/navigation/AppNavigator';
import { navigationRef } from '@/navigation/navigationRef';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { AppStatusBarProps } from './AppStatusBar.types';

/** Screens whose own top layer is dark in both themes, so the clock above it must be light. */
const LIGHT_STATUS_BAR_ROUTES = new Set<string>(['Home']);
/** How often to look again for a container that is still mounting. */
const READY_POLL_MS = 50;

/**
 * The clock and the battery, decided by the screen underneath them rather than by the theme
 * alone. Ana sayfa (H1) paints a deep green layer to the top edge in both themes, and in light
 * mode the app's own dark status bar text disappeared into it.
 *
 * **Read from the container's ref, not `useNavigationState`.** This sits beside the navigator
 * rather than inside one, where that hook throws — and a screen that sets the style from its
 * own focus effect loses a different race: a child's effects run before its parents', so the
 * moment the theme changed, the root's `StatusBar` re-applied the theme's style over the
 * screen's. Subscribing here means one component decides, after both.
 */
export const AppStatusBar = ({ isSplashVisible }: AppStatusBarProps) => {
	const { theme } = useThemeContext();
	const [isOverDarkHeader, setIsOverDarkHeader] = useState(false);

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;
		let retry: ReturnType<typeof setTimeout> | undefined;

		const read = () => {
			const name = focusedRouteName(navigationRef.getRootState());

			setIsOverDarkHeader(name !== undefined && LIGHT_STATUS_BAR_ROUTES.has(name));
		};

		// The container sets its ref up in its own effect, which runs after this one.
		const attach = () => {
			if (!navigationRef.isReady()) {
				retry = setTimeout(attach, READY_POLL_MS);

				return;
			}

			read();
			unsubscribe = navigationRef.addListener('state', read);
		};

		attach();

		return () => {
			if (retry) {
				clearTimeout(retry);
			}

			unsubscribe?.();
		};
	}, []);

	return <StatusBar style={theme.mode === 'dark' || isSplashVisible || isOverDarkHeader ? 'light' : 'dark'} />;
};
