import { INTERNAL_SERVER_ERROR, TOO_MANY_REQUESTS } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import type { AuthLocals } from '@middleware/auth.middleware';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

const userKey = (_req: Request, res: Response<object, Partial<AuthLocals>>) => {
	const userId = res.locals.auth?.userId;

	if (!userId) {
		throw new HttpError(INTERNAL_SERVER_ERROR, 'Rate limit requires authenticated user');
	}

	return userId;
};

const tooManyRequestsHandler = (_req: Request, res: Response) => {
	res.status(TOO_MANY_REQUESTS).json({ error: 'Too many requests, please slow down.' });
};

export const joinRateLimit = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	limit: 10, // 10 requests per minute
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

export const createGroupRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	limit: 10, // 10 requests per hour
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

export const cheerRateLimit = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	limit: 30, // 30 requests per minute
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});
