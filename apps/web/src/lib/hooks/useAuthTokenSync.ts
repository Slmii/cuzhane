import { setAuthTokenResolver } from '@/api/wrapper.api';
import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';

/**
 * Wires Clerk's `getToken` into the API wrapper so every outgoing
 * request automatically includes the session JWT.
 * Mount this once inside the authenticated portion of the component tree.
 */
export const useAuthTokenSync = () => {
	const { getToken } = useAuth();
	const mounted = useRef(false);

	useEffect(() => {
		if (mounted.current) {
			return;
		}

		mounted.current = true;

		setAuthTokenResolver(getToken);
	}, [getToken]);
};
