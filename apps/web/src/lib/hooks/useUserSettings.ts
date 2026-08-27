import { getUserSettings, updateUserSettings, type UpdateUserSettingsInput } from '@/api/userSettings.api';
import { UserSettings } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userSettingsQueryKeys } from './queryKeys';

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
