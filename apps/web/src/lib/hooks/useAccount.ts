import { deleteAccount } from '@/api/account.api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useDeleteAccount = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteAccount,
		onSuccess: () => {
			queryClient.clear();
		}
	});
};
