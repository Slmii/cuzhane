import { getAuth } from '@clerk/express';
import { UNAUTHORIZED } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import { NextFunction, Request, Response } from 'express';

export type AuthLocals = {
	auth: {
		userId: string;
		isAuthenticated: boolean;
	};
};

/**
 * Populates `res.locals.auth` with the authenticated user id
 * so downstream handlers can access it uniformly.
 */
export const populateAuthLocals = (req: Request, res: Response<object, AuthLocals>, next: NextFunction) => {
	const { userId } = getAuth(req);

	if (!userId) {
		throw new HttpError(UNAUTHORIZED, 'Unauthorized');
	}

	res.locals.auth = {
		isAuthenticated: true,
		userId
	};

	next();
};
