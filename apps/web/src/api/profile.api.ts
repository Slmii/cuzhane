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

/**
 * Asks the server to drop its cached copy of the signed-in user's Clerk profile.
 *
 * Names are looked up from Clerk and held for a minute, which is right for everybody else's
 * and wrong for your own the moment you change it — that is exactly when you go looking.
 * The server evicts the caller and nobody else; there is no id to send.
 */
export const refreshMyProfile = async () => wrapperApi<{ ok: boolean }>('/profile/refresh', { method: 'POST' });
