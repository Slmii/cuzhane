import { liveSession, type LiveMarkStore, type LiveSessionState } from '@/lib/live/liveSession';
import { useSyncExternalStore } from 'react';

export type {
	LiveHandle,
	LiveMarkState,
	LiveMarkStore,
	LivePlace,
	LiveReadingState,
	LiveSessionState
} from '@/lib/live/liveSession';

/**
 * The app's live reading as React sees it — re-rendering only when something shown as words
 * changes (who is here, the status, the bab or page, whether a follower follows), never per
 * scroll. Null when there is no session. What the "return to reading" strip and the readers read.
 */
export const useLiveSessionState = (): LiveSessionState | null =>
	useSyncExternalStore(liveSession.subscribe, liveSession.getSnapshot);

/** The band's view of the reader's line — the one place it becomes state, in the band alone. */
export const useLiveMark = (store: LiveMarkStore) => useSyncExternalStore(store.subscribe, store.get);
