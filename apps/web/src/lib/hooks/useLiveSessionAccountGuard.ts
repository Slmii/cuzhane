import { liveSession } from '@/lib/live/liveSession';
import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';

/**
 * **A live reading belongs to the account it was started or joined with.** It is the app's, not
 * a screen's (`lib/live/liveSession`), so nothing else would let go of it when someone signs out or
 * another account signs in — and its socket would keep asking for a token that is gone. When the
 * account changes it is dropped, asking the server for nothing: a session this person led ends
 * after the server's grace window, as when their phone drops out. Mount once, above the navigator.
 */
export const useLiveSessionAccountGuard = () => {
	const { userId } = useAuth();

	useEffect(() => () => liveSession.reset(), [userId]);
};
