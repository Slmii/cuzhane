import { setAuthTokenResolver, setMissingTokenHandler } from '@/api/wrapper.api';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

/**
 * Wires Clerk's `getToken` into the API wrapper so every outgoing request automatically
 * includes the session JWT — and wires the other direction: a request that finds **no
 * token** signs the session out, which flips `AppNavigator` to the sign-in stack. A
 * signed-in session that can't produce a JWT is over as far as the server is concerned;
 * left alone it showed an error page whose "Tekrar dene" could never succeed.
 *
 * Two guards keep that from misfiring. It only acts while Clerk still says *signed in*:
 * `AppNavigator` runs the settings query before it checks `isSignedIn`, so a signed-out
 * app also makes token-less requests, and signing out on those would clear the cache,
 * refetch, and go round again. And it runs once per episode — many queries fail at the
 * same moment — with `isSigningOut` held until Clerk resolves. The cache is cleared as the
 * Profile sign-out does, so the next account on this device doesn't see this one's groups
 * for a beat. Mount this once, above the navigator.
 */
export const useAuthTokenSync = () => {
	const { getToken, isSignedIn, signOut } = useAuth();
	const queryClient = useQueryClient();
	const mounted = useRef(false);
	const isSigningOut = useRef(false);
	const isSignedInRef = useRef(isSignedIn);

	useEffect(() => {
		isSignedInRef.current = isSignedIn;
	}, [isSignedIn]);

	useEffect(() => {
		if (mounted.current) {
			return;
		}

		mounted.current = true;

		setAuthTokenResolver(getToken);
		setMissingTokenHandler(() => {
			if (!isSignedInRef.current || isSigningOut.current) {
				return;
			}

			isSigningOut.current = true;

			void signOut().finally(() => {
				queryClient.clear();
				isSigningOut.current = false;
			});
		});
	}, [getToken, queryClient, signOut]);
};
