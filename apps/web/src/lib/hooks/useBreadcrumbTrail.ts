import { navigationRef } from '@/navigation/navigationRef';
import { addBreadcrumb, describeFocus } from '@/lib/utils/breadcrumbs';
import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * Feeds the breadcrumb trail (`lib/utils/breadcrumbs`) for the whole session: every navigation
 * action by its type and target ("action NAVIGATE GroupDetail", "action POP"), where the user is
 * after it, and each move of the app to the background and back. What closed a screen, and when,
 * is then in the trail a bug report carries.
 *
 * Listens on the container ref, which takes listeners before the container is ready and attaches
 * them once it is.
 */
export const useBreadcrumbTrail = () => {
	useEffect(() => {
		addBreadcrumb(`app ${AppState.currentState}`);

		const appState = AppState.addEventListener('change', status => addBreadcrumb(`app ${status}`));
		const actions = navigationRef.addListener('__unsafe_action__', event => {
			const { action } = event.data;
			const target =
				action.payload && typeof action.payload === 'object' && 'name' in action.payload
					? ` ${String(action.payload.name)}`
					: '';

			addBreadcrumb(`action ${action.type}${target}`);
		});
		const focus = navigationRef.addListener('state', event => addBreadcrumb(describeFocus(event.data.state)));

		return () => {
			appState.remove();
			actions();
			focus();
		};
	}, []);
};
