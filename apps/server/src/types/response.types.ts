import { AuthLocals } from '@middleware/auth.middleware';
import { ClientCapabilityLocals } from '@middleware/clientCapabilities.middleware';

/** What every `/api` request carries by the time it reaches a router — see `app.ts`. */
type ApiLocals = AuthLocals & ClientCapabilityLocals;

export type ResponseLocals<T = unknown> = ApiLocals & {
	validatedBody?: T;
	validatedQuery?: T;
};

export type ResponseLocalsWithBody<T = unknown> = ApiLocals & {
	validatedBody: T;
	validatedQuery?: unknown;
};

export type ResponseLocalsWithQuery<T = unknown> = ApiLocals & {
	validatedQuery: T;
	validatedBody?: unknown;
};
