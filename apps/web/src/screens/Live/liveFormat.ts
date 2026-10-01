import type { LivePlace } from '@/lib/hooks/useLiveSession';
import type { StringKey } from '@/lib/i18n/strings';

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

/** "Cevşen · 14. Bab" / "Kur’an · 22. cüz, sayfa 5" — where the reader is, in the row and the sheets. */
export const formatLivePlace = (place: LivePlace, t: Translate) =>
	place.k === 'CEVSEN'
		? t('livePlaceCevsen', { bab: place.bab })
		: t('livePlaceQuran', { cuz: place.cuz, page: place.page });

/** The reader's grace window as the row counts it down — the server's `LEADER_GRACE_MS`. */
export const LIVE_GRACE_SECONDS = 60;

export const formatCountdown = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
