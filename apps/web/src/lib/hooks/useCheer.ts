import { toggleCheer, type ToggleCheerInput } from '@/api/cheers.api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { groupQueryKeys } from './queryKeys';

export const useToggleCheer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: ToggleCheerInput) => toggleCheer(input),
		onSettled: async (_data, _error, input) => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.members(input.groupId) });
		}
	});
};
