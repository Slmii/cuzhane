import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Teaches TanStack Query what "focused" means on React Native.
 *
 * `refetchOnWindowFocus` defaults to true, but it hangs off a browser event that never
 * fires here — so without this, coming back to the app after an hour showed whatever was
 * cached when you left. Feeding `AppState` into the focus manager makes returning to the
 * foreground refresh every stale query, which for a group board is the moment it matters:
 * other members read their babs while you were away.
 */
export const useAppFocusSync = () => {
	useEffect(() => {
		const handleChange = (status: AppStateStatus) => {
			focusManager.setFocused(status === 'active');
		};

		const subscription = AppState.addEventListener('change', handleChange);

		return () => subscription.remove();
	}, []);
};
