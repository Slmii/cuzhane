import { getUserSettings, updateUserSettings, type UpdateUserSettingsInput } from '@/api/userSettings.api';
import { UserSettings } from '@/lib/types/domain';
import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userSettingsQueryKeys } from './queryKeys';

/**
 * **Never ask for settings while signed out.** Without the guard this fires the moment
 * `AppNavigator` mounts — which is before anyone has signed in — and a request with no
 * session token is a 401. TanStack caches that failure, so when the reader *does* sign in the
 * gate finds an error that belongs to a moment when they had no account, and shows
 * `ErrorState` over a perfectly good session. "Tekrar dene" then works, which is what made it
 * look like a flaky server rather than a stale result.
 *
 * It presented as a **Google-only** bug, and the reason is timing rather than Clerk. The
 * default retry is three attempts backing off over roughly seven seconds: sign in with email
 * or Apple and the session lands while those retries are still running, so one of them
 * succeeds and nothing is ever shown. Google leaves the app for a browser — pick an account,
 * come back — which takes longer than the retries last, so the query has already settled into
 * a cached error by the time the session exists.
 */
export const useGetUserSettings = () => {
	const { isSignedIn } = useAuth();

	return useQuery({
		queryKey: userSettingsQueryKeys.settings(),
		queryFn: getUserSettings,
		enabled: isSignedIn === true
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
