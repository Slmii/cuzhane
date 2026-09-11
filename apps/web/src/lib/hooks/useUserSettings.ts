import { getUserSettings, updateUserSettings, type UpdateUserSettingsInput } from '@/api/userSettings.api';
import { UserSettings } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userSettingsQueryKeys } from './queryKeys';

/**
 * **Do not gate this on `isSignedIn`.** It looks like the obvious fix for the stale 401 —
 * this query fires as `AppNavigator` mounts, before anyone has signed in, and the cached
 * failure is what puts `ErrorState` in front of a reader who has just signed in with Google.
 * `enabled: isSignedIn === true` was shipped for exactly that and **destroyed the session**:
 * it moves the first request to the instant Clerk flips to signed-in, which is before Clerk
 * can mint a JWT. `resolveAuthToken` gives up after 3 × 120ms, and `wrapper.api.ts` then calls
 * the missing-token handler — which signs the reader out, because `useAuthTokenSync` only
 * returns early when `isSignedIn` is *false*. Firing the query while signed out is what kept
 * that 401 harmless. Home sat on its skeleton, fell to `ErrorState` after the retries, and
 * "Tekrar dene" could never work because the session was already gone.
 *
 * The real fix has to wait on the **token**, not on the flag — or stop a signed-out failure
 * being retained across the sign-in boundary. Neither is a one-line change to this hook.
 */
export const useGetUserSettings = () => {
	return useQuery({
		queryKey: userSettingsQueryKeys.settings(),
		queryFn: getUserSettings
	});
};

export const useUpdateUserSettings = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UpdateUserSettingsInput) => updateUserSettings(input),
		onMutate: async input => {
			await queryClient.cancelQueries({ queryKey: userSettingsQueryKeys.settings() });
			const previousSettings = queryClient.getQueryData<UserSettings>(userSettingsQueryKeys.settings());

			if (previousSettings) {
				queryClient.setQueryData<UserSettings>(userSettingsQueryKeys.settings(), {
					...previousSettings,
					...input
				});
			}

			return { previousSettings };
		},
		onError: (_error, _input, context) => {
			if (context?.previousSettings) {
				queryClient.setQueryData(userSettingsQueryKeys.settings(), context.previousSettings);
			}
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: userSettingsQueryKeys.settings() });
		}
	});
};
