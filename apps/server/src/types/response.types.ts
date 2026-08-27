import { AuthLocals } from '@middleware/auth.middleware';

export type ResponseLocals<T = unknown> = AuthLocals & {
	validatedBody?: T;
	validatedQuery?: T;
};

export type ResponseLocalsWithBody<T = unknown> = AuthLocals & {
	validatedBody: T;
	validatedQuery?: unknown;
};

export type ResponseLocalsWithQuery<T = unknown> = AuthLocals & {
	validatedQuery: T;
	validatedBody?: unknown;
};
