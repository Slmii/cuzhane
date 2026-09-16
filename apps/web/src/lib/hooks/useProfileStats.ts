import { useIsTourDemo } from '@/components/Tour/Tour.context';
import { TOUR_DEMO_PROFILE_STATS } from '@/components/Tour/tourDemoData';
import { tourDemoQueryKeys } from '@/lib/hooks/queryKeys';
import { getProfileStats } from '@/api/profile.api';
import { useQuery } from '@tanstack/react-query';
import { profileQueryKeys } from './queryKeys';

// See `useGetGroups` for why the tour answers its own queries.
export const useGetProfileStats = () => {
	const isDemo = useIsTourDemo();

	return useQuery({
		queryKey: isDemo ? tourDemoQueryKeys.stats() : profileQueryKeys.stats(),
		queryFn: isDemo ? async () => TOUR_DEMO_PROFILE_STATS : getProfileStats,
		...(isDemo ? { initialData: () => TOUR_DEMO_PROFILE_STATS, staleTime: Infinity } : {})
	});
};
