/**
 * Clerk wraps a failed API call in a `ClerkAPIResponseError`, whose own `code` is always
 * the useless `'api_response_error'` — the codes that say what actually went wrong
 * (`form_password_pwned`, `form_identifier_exists`, …) live in its `errors` array.
 *
 * The signals API types that value as the base `ClerkError`, which has no `errors`
 * field, so the nested list has to be read through a cast. Reading only `error.code`
 * means every API rejection looks identical.
 */
type NestedClerkError = { code: string; message?: string; longMessage?: string };

export type ClerkErrorLike = { code: string; message?: string };

/**
 * The specific codes behind a Clerk error, most useful first. Falls back to the wrapper's
 * own code for errors that aren't API responses (transport failures, for instance).
 */
export const clerkErrorCodes = (error: ClerkErrorLike): string[] => {
	const nested = (error as { errors?: NestedClerkError[] }).errors;

	if (Array.isArray(nested) && nested.length > 0) {
		return nested.map(entry => entry.code).filter(Boolean);
	}

	return [error.code];
};

/** One line naming every code and message Clerk sent — for dev logging only. */
export const describeClerkError = (error: ClerkErrorLike): string => {
	const nested = (error as { errors?: NestedClerkError[] }).errors;

	if (Array.isArray(nested) && nested.length > 0) {
		return nested.map(entry => `${entry.code}: ${entry.longMessage ?? entry.message ?? ''}`).join(' | ');
	}

	return `${error.code}: ${error.message ?? ''}`;
};
