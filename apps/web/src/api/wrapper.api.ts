import { API_BASE_URL } from '@/lib/constants';

interface ApiError {
	code: number;
	message: string;
}

export class WrapperApiError extends Error {
	code: number;

	constructor(error: ApiError) {
		super(error.message);
		this.code = error.code;
		this.name = 'WrapperApiError';
	}
}

/** Holds a reference to the Clerk `getToken` function, set at app startup. */
let _getToken: (() => Promise<string | null>) | null = null;
const AUTH_TOKEN_MAX_ATTEMPTS = 3;
const AUTH_TOKEN_RETRY_DELAY_MS = 120;

/** Call once from the app layer to wire token retrieval into the API client. */
export const setAuthTokenResolver = (getter: () => Promise<string | null>) => {
	_getToken = getter;
};

const wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const resolveAuthToken = async () => {
	if (!_getToken) {
		return null;
	}

	for (let attempt = 0; attempt < AUTH_TOKEN_MAX_ATTEMPTS; attempt += 1) {
		const token = await _getToken();

		if (token) {
			return token;
		}

		if (attempt < AUTH_TOKEN_MAX_ATTEMPTS - 1) {
			await wait(AUTH_TOKEN_RETRY_DELAY_MS);
		}
	}

	return null;
};

export const wrapperApi = async <T>(endpoint: string, init?: RequestInit): Promise<T> => {
	const isFormData = init?.body instanceof FormData;
	const token = await resolveAuthToken();
	const fullUrl = `${API_BASE_URL}/api${endpoint}`;

	if (__DEV__) {
		console.log(
			'[api:request]',
			init?.method ?? 'GET',
			fullUrl,
			'tokenPresent=',
			!!token,
			'tokenLen=',
			token?.length
		);
	}

	if (!token) {
		if (__DEV__) {
			console.log('[api:request] aborting — no token');
		}
		throw new WrapperApiError({
			code: 401,
			message: 'Authentication token is not ready. Please retry.'
		});
	}

	let response: Response;
	try {
		response = await fetch(fullUrl, {
			...init,
			headers: {
				// Don't set Content-Type for FormData - browser sets it with boundary
				...(isFormData ? {} : { 'Content-Type': 'application/json' }),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...(init?.headers || {})
			}
		});
	} catch (err) {
		if (__DEV__) {
			console.log('[api:request] fetch threw:', err instanceof Error ? err.message : err);
		}
		throw err;
	}

	if (__DEV__) {
		console.log('[api:response]', response.status, fullUrl);
	}

	const data = await response.json();

	if (!response.ok) {
		if (__DEV__) {
			console.log(
				'API Error:',
				JSON.stringify(
					{
						endpoint: fullUrl,
						status: response.status,
						response: data
					},
					null,
					2
				)
			);
		}

		throw new WrapperApiError(data as ApiError);
	}

	return data as T;
};
