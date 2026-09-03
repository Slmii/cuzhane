import { clerkErrorCodes, type ClerkErrorLike } from '@/lib/utils/clerkErrors';

/**
 * Every way sign-in can fail, reduced to the two the screen tells apart: the request never
 * left the phone (`offline`), or it did and was refused (`server`). A2e drew a banner per
 * cause — wrong password, unknown address, malformed address, lockout — and the app settled on
 * one generic banner for all of them instead: the screen no longer says whether an address
 * exists or which half of the credentials was wrong.
 */
export type SignInErrorKind = 'server' | 'offline';

export interface SignInError {
	kind: SignInErrorKind;
	/** For `server`: the HTTP status, when there is one, for the footnote. */
	status?: number;
}

/**
 * The codes are Clerk's own, read through `clerkErrorCodes` because the wrapper's `code` is
 * always the useless `api_response_error` — see `clerkErrors.ts`. `network_error` is the one
 * exception: a request that never reached Clerk carries it as the wrapper's own code, which is
 * exactly the case the fallback there exists for.
 */
export const classifySignInError = (error: ClerkErrorLike): SignInError => {
	if (clerkErrorCodes(error).includes('network_error')) {
		return { kind: 'offline' };
	}

	const status = (error as { status?: number }).status;

	return typeof status === 'number' ? { kind: 'server', status } : { kind: 'server' };
};
