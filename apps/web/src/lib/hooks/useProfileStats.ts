import { getProfileStats } from '@/api/profile.api';
import { useQuery } from '@tanstack/react-query';
import { profileQueryKeys } from './queryKeys';

export const useGetProfileStats = () =>
	useQuery({
		queryKey: profileQueryKeys.stats(),
		queryFn: getProfileStats
	});
