import { navigationRef } from '@/navigation/navigationRef';
import { StackActions } from '@react-navigation/native';
import { Linking } from 'react-native';

/**
 * **A link waits for the tabs.** React Navigation hands a URL to whatever navigator is mounted
 * when it arrives. Signed out, that is the auth stack, which cannot hold `Tabs › Groups` and
 * drops it; on Onboarding, a cold link would replace the initial route and skip the tour
 * without ever marking it seen. Either way the person who scanned a QR, then signed up, landed
 * on Ana sayfa with no sheet and no code — and a new member is exactly who scans.
 *
 * So the container is given these instead of the defaults: a URL that arrives before the tab
 * navigator has mounted is held here, and released to the container's own listener the moment
 * it does. Released, it is an ordinary warm link — `NAVIGATE` into a navigator that exists.
 * One URL is kept, the latest; a scan supersedes an older one.
 */
let listener: ((url: string) => void) | null = null;
let pendingUrl: string | null = null;
let isReady = false;

/**
 * Keeps a URL for later — and brings the signed-out flow back to its first screen. A scan
 * from the camera opens the app wherever it was left, and left on the sign-up form that read
 * as the QR having done nothing; an invite arriving is a fresh start, so the auth stack pops
 * to sign-in. Only the auth stack can be mounted here: the tabs being up is what `isReady`
 * means, and Onboarding sits alone on its stack, so the pop is a no-op there.
 */
const hold = (url: string) => {
	pendingUrl = url;

	if (navigationRef.isReady()) {
		navigationRef.dispatch(StackActions.popToTop());
	}
};

/**
 * **The OAuth redirect is not an app link.** `linking.ts` claims the whole `cuzhane://` scheme,
 * so the URL Clerk sends the browser back to — `cuzhane://sso-callback` — arrives here looking
 * like navigation. It is not: the auth session consumes it, and there is no screen behind it.
 *
 * Left to the gate it did real damage. Signed out the tabs are not mounted, so it took the
 * `hold` path and dispatched `popToTop()` **on the auth stack, mid sign-in**, tearing the
 * screen out from under a flow that had not finished; then, once the tabs came up, the gate
 * released a URL that matches no route. Sign-in is the one moment this scheme is used for
 * something other than a link.
 */
const isAuthCallback = (url: string) => url.includes('sso-callback');

const deliver = (url: string) => {
	if (isAuthCallback(url)) {
		return;
	}

	if (isReady && listener !== null) {
		listener(url);
	} else {
		hold(url);
	}
};

/** For `LinkingOptions.getInitialURL`: the launch URL, unless the tabs aren't up yet. */
export const getGatedInitialURL = async () => {
	const url = await Linking.getInitialURL();

	if (url === null || isAuthCallback(url) || isReady) {
		return url === null || isAuthCallback(url) ? null : url;
	}

	hold(url);

	return null;
};

/** For `LinkingOptions.subscribe`: the container's listener, fed only once the tabs are up. */
export const subscribeGated = (onUrl: (url: string) => void) => {
	listener = onUrl;
	const subscription = Linking.addEventListener('url', ({ url }) => deliver(url));

	return () => {
		subscription.remove();
		listener = null;
	};
};

/** How often to look again for a container that is still mounting. */
const READY_POLL_MS = 50;

/**
 * Hands a held URL to the container once it can act on it. The tab navigator's mount effect
 * runs before the container's own — effects fire child-first — so at the moment the gate
 * opens the container's `navigation` is not initialised yet, and dispatching straight away
 * logged "The 'navigation' object hasn't been initialized" and dropped the link. A signed-out
 * scan that had survived sign-in died on the last step. So it waits for `isReady()`.
 */
const releasePending = () => {
	if (!isReady || pendingUrl === null || listener === null) {
		return;
	}

	if (!navigationRef.isReady()) {
		setTimeout(releasePending, READY_POLL_MS);

		return;
	}

	const url = pendingUrl;
	pendingUrl = null;
	listener(url);
};

/** Called by the tab navigator as it mounts and unmounts. Mounting releases whatever waited. */
export const setLinkGateReady = (ready: boolean) => {
	isReady = ready;
	releasePending();
};
