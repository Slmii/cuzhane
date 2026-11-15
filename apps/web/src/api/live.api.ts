import { wrapperApi } from '@/api/wrapper.api';
import type { LiveReadingKind, LiveSessionPreview, LiveVoiceListening, LiveVoiceStarted } from '@/lib/types/domain';

/** Live reading's ordinary requests; following it happens on the socket (`lib/live/liveConnection`). */
export const startLiveSession = async (kind: LiveReadingKind) =>
	wrapperApi<LiveSessionPreview>('/live', { body: JSON.stringify({ kind }), method: 'POST' });

export const getLiveSession = async (code: string) =>
	wrapperApi<LiveSessionPreview>(`/live/${encodeURIComponent(code)}`, { method: 'GET' });

export const endLiveSession = async (sessionId: string) =>
	wrapperApi<{ success: true }>(`/live/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });

/*
 * Live voice: the API only lets people in and hands over the WebRTC descriptions — the voice
 * itself travels through Cloudflare (`lib/live/liveVoice`).
 */

/** The reader's offer for their microphone track (`mid`); answers with Cloudflare's answer. */
export const startLiveVoice = async (sessionId: string, body: { sdp: string; mid: string }) =>
	wrapperApi<LiveVoiceStarted>(`/live/${encodeURIComponent(sessionId)}/voice`, {
		body: JSON.stringify(body),
		method: 'POST'
	});

export const stopLiveVoice = async (sessionId: string) =>
	wrapperApi<{ success: true }>(`/live/${encodeURIComponent(sessionId)}/voice`, { method: 'DELETE' });

/** A follower asks to hear the reader; answers with Cloudflare's offer for them to answer. */
export const listenLiveVoice = async (sessionId: string) =>
	wrapperApi<LiveVoiceListening>(`/live/${encodeURIComponent(sessionId)}/voice/listen`, { method: 'POST' });

export const answerLiveVoice = async (sessionId: string, body: { listenerSessionId: string; sdp: string }) =>
	wrapperApi<{ success: true }>(`/live/${encodeURIComponent(sessionId)}/voice/listen`, {
		body: JSON.stringify(body),
		method: 'PUT'
	});

/** A follower stops: the reader's list no longer says they are listening. */
export const stopListeningLiveVoice = async (sessionId: string, body: { listenerSessionId: string }) =>
	wrapperApi<{ success: true }>(`/live/${encodeURIComponent(sessionId)}/voice/listen`, {
		body: JSON.stringify(body),
		method: 'DELETE'
	});
