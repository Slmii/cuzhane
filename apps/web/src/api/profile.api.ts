import { wrapperApi } from '@/api/wrapper.api';
import { ProfileStats } from '@/lib/types/domain';
import { deviceTimeZone } from '@/lib/utils/timezone';

export const getProfileStats = async () => {
	// The streak and heatmap are about the reader's own days, so they are bucketed in the
	// device's zone rather than the server's. Omitted when the platform can't report one;
	// the server then falls back to its default.
	const timezone = deviceTimeZone();
	const query = timezone ? `?timezone=${encodeURIComponent(timezone)}` : '';

	return wrapperApi<ProfileStats>(`/profile/stats${query}`, { method: 'GET' });
};
