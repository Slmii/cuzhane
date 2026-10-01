import { wrapperApi } from '@/api/wrapper.api';
import type { LiveReadingKind, LiveSessionPreview } from '@/lib/types/domain';

/** Live reading's ordinary requests; following it happens on the socket (`lib/live/liveConnection`). */
export const startLiveSession = async (kind: LiveReadingKind) =>
	wrapperApi<LiveSessionPreview>('/live', { body: JSON.stringify({ kind }), method: 'POST' });

export const getLiveSession = async (code: string) =>
	wrapperApi<LiveSessionPreview>(`/live/${encodeURIComponent(code)}`, { method: 'GET' });

export const endLiveSession = async (sessionId: string) =>
	wrapperApi<{ success: true }>(`/live/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
